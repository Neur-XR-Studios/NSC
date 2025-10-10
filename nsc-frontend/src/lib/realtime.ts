import { Client as PahoClient, Message as PahoMessage } from 'paho-mqtt'
import { io, Socket } from 'socket.io-client'

export type RealtimeMode = 'mqtt' | 'bridge'

export type RealtimeMessage = {
  destinationName: string
  payloadString?: string
}

export type RealtimeOptions = {
  url: string
  clientId?: string
  username?: string
  password?: string
  forceBridge?: boolean
}

type Subscription = {
  topic: string
  qos?: 0 | 1 | 2
}

/**
 * RealtimeClient wraps Socket.IO bridge and Paho MQTT into a unified interface.
 */
export class RealtimeClient {
  private mode: RealtimeMode = 'mqtt'
  private connected = false
  private isConnecting = false
  private connectPromise: Promise<void> | null = null
  private client: PahoClient | null = null
  private bridge: Socket | null = null
  private subs: Subscription[] = []
  private onMessageHandlers: Array<(msg: RealtimeMessage) => void> = []
  private onConnectHandlers: Array<() => void> = []
  private onDisconnectHandlers: Array<() => void> = []
  private bridgeEventHandlers: Array<{ event: string; handler: (payload: unknown) => void }> = []

  get isConnected(): boolean {
    return this.connected
  }

  get currentMode(): RealtimeMode {
    return this.mode
  }

  onMessage(handler: (msg: RealtimeMessage) => void) {
    this.onMessageHandlers.push(handler)
    return () => {
      this.onMessageHandlers = this.onMessageHandlers.filter((h) => h !== handler)
    }
  }

  onConnect(handler: () => void) {
    this.onConnectHandlers.push(handler)
    return () => {
      this.onConnectHandlers = this.onConnectHandlers.filter((h) => h !== handler)
    }
  }

  onDisconnect(handler: () => void) {
    this.onDisconnectHandlers.push(handler)
    return () => {
      this.onDisconnectHandlers = this.onDisconnectHandlers.filter((h) => h !== handler)
    }
  }

  private emitMessage(msg: RealtimeMessage) {
    for (const h of this.onMessageHandlers) h(msg)
  }

  private emitConnect() {
    for (const h of this.onConnectHandlers) h()
  }

  private emitDisconnect() {
    for (const h of this.onDisconnectHandlers) h()
  }

  async connect(opts: RealtimeOptions): Promise<void> {
    if (this.connected) return
    if (this.isConnecting && this.connectPromise) return this.connectPromise
    this.isConnecting = true
    const { url, clientId, username, password, forceBridge } = opts
    const u = new URL(url.trim())
    const useBridge = forceBridge || u.protocol === 'http:' || u.protocol === 'https:'

    if (useBridge) {
      this.mode = 'bridge'
      const socket = io(url.trim(), { transports: ['websocket'] })
      this.bridge = socket

      socket.on('connect', () => {
        this.connected = true
        this.isConnecting = false
        this.connectPromise = null
        this.emitConnect()
        // Resubscribe topics via bridge
        for (const s of this.subs) {
          socket.emit('mqtt_subscribe', { topic: s.topic, options: { qos: s.qos ?? 1 } })
        }
      })
      socket.on('disconnect', () => {
        this.connected = false
        this.emitDisconnect()
      })
      // Re-bind custom bridge event handlers
      for (const { event, handler } of this.bridgeEventHandlers) {
        socket.on(event, handler)
      }
      socket.on('mqtt_message', ({ topic, payload }: { topic: string; payload: unknown }) => {
        const msg: RealtimeMessage = {
          destinationName: topic,
          payloadString: typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
        }
        this.emitMessage(msg)
      })
      this.connectPromise = Promise.resolve()
      return this.connectPromise
    }

    // Raw MQTT via Paho
    this.mode = 'mqtt'
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '/'
    const isSecure = u.protocol === 'wss:'
    const port = u.port ? Number(u.port) : isSecure ? 443 : 80
    const c = new PahoClient(
      u.hostname,
      port,
      path,
      (clientId || `admin-${Math.random().toString(36).slice(2, 8)}`).toUpperCase()
    )
    this.client = c
    c.onConnectionLost = () => {
      this.connected = false
      this.emitDisconnect()
    }
    c.onMessageArrived = (msg: RealtimeMessage) => this.emitMessage(msg)
    this.connectPromise = new Promise<void>((resolve, reject) => {
      c.connect({
        useSSL: isSecure,
        userName: username,
        password: password,
        cleanSession: true,
        timeout: 5,
        onSuccess: () => {
          this.connected = true
          this.isConnecting = false
          this.connectPromise = null
          // Resubscribe topics
          for (const s of this.subs) c.subscribe(s.topic, { qos: s.qos ?? 1 })
          this.emitConnect()
          resolve()
        },
        onFailure: (e: unknown) => reject(e),
      })
    })
    return this.connectPromise
  }

  disconnect() {
    if (this.mode === 'bridge') {
      if (this.bridge) this.bridge.disconnect()
      this.bridge = null
    } else if (this.client) {
      try {
        this.client.disconnect()
      } catch {
        // ignore
      }
      this.client = null
    }
    this.connected = false
    this.emitDisconnect()
  }

  subscribe(topic: string, qos: 0 | 1 | 2 = 1) {
    const existing = this.subs.find((s) => s.topic === topic)
    if (!existing) this.subs.push({ topic, qos })
    if (!this.connected) return
    if (this.mode === 'bridge') {
      const b = this.bridge
      if (!b) return
      b.emit('mqtt_subscribe', { topic, options: { qos } })
    } else {
      const c = this.client
      if (!c) return
      c.subscribe(topic, { qos })
    }
  }

  publish(topic: string, payload: string, retain = false, qos: 0 | 1 | 2 = 1) {
    if (!this.connected) return
    if (this.mode === 'bridge') {
      const b = this.bridge
      if (!b) return
      b.emit('mqtt_publish', { topic, payload, options: { qos, retain } })
    } else {
      const c = this.client
      if (!c) return
      const m = new PahoMessage(payload)
      m.destinationName = topic
      m.qos = qos
      m.retained = retain
      c.send(m)
    }
  }

  // Bridge helpers for custom events
  onBridge(event: string, handler: (payload: unknown) => void) {
    this.bridgeEventHandlers.push({ event, handler })
    if (this.mode === 'bridge' && this.bridge) {
      this.bridge.on(event, handler)
    }
    return () => {
      this.bridgeEventHandlers = this.bridgeEventHandlers.filter((h) => !(h.event === event && h.handler === handler))
      if (this.mode === 'bridge' && this.bridge) {
        this.bridge.off(event, handler)
      }
    }
  }

  emitBridge(event: string, payload?: unknown) {
    if (this.mode !== 'bridge' || !this.bridge) return
    this.bridge.emit(event, payload)
  }
}

export const realtime = new RealtimeClient()


