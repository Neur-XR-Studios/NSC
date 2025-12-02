import mqtt, { MqttClient } from 'mqtt';

type MessageHandler = (msg: { destinationName: string; payloadString: string }) => void;
type EventHandler = (data: unknown) => void;

class MqttRealtimeService {
  private client: MqttClient | null = null;
  private messageHandlers: MessageHandler[] = [];
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  public isConnected = false;

  /**
   * Connect to MQTT broker via WebSocket
   */
  async connect(options: {
    url: string;
    clientId: string;
    username?: string;
    password?: string;
  }): Promise<void> {
    // Prevent multiple simultaneous connections
    if (this.client) {
      console.warn('[MQTT] Already connected or connecting');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        // Parse URL to determine WebSocket protocol
        const wsUrl = options.url.replace(/^http/, 'ws');
        
        // Add timestamp to client ID to ensure uniqueness across page refreshes
        const uniqueClientId = `${options.clientId}_${Date.now()}`;
        
        this.client = mqtt.connect(wsUrl, {
          clientId: uniqueClientId,
          username: options.username,
          password: options.password,
          clean: true, // Admin doesn't need persistent session
          reconnectPeriod: 5000, // Wait 5 seconds between reconnect attempts (not 1 second)
          connectTimeout: 30000, // 30 second timeout
          keepalive: 60, // Send keepalive ping every 60 seconds
        });

        this.client.on('connect', () => {
          this.isConnected = true;
          console.log('[MQTT] Connected to broker:', wsUrl);
          resolve();
        });

        this.client.on('error', (error) => {
          console.error('[MQTT] Connection error:', error);
          // Don't reject on error if already connected, let reconnect handle it
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.client.on('message', (topic, payload) => {
          const msg = {
            destinationName: topic,
            payloadString: payload.toString(),
          };
          
          // Call all registered message handlers
          this.messageHandlers.forEach(handler => handler(msg));
        });

        this.client.on('close', () => {
          this.isConnected = false;
          console.log('[MQTT] Disconnected from broker');
        });

        this.client.on('offline', () => {
          this.isConnected = false;
          console.log('[MQTT] Client offline');
        });

        this.client.on('reconnect', () => {
          console.log('[MQTT] Reconnecting...');
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to MQTT topic
   */
  subscribe(topic: string, qos: 0 | 1 | 2 = 1): void {
    if (!this.client) {
      console.warn('[MQTT] Cannot subscribe, client not initialized');
      return;
    }

    // Allow subscription even if isConnected flag hasn't been set yet
    // The MQTT client handles queuing subscriptions internally
    this.client.subscribe(topic, { qos }, (error) => {
      if (error) {
        console.error('[MQTT] Subscribe error:', topic, error);
      } else {
        console.log('[MQTT] Subscribed to:', topic);
      }
    });
  }

  /**
   * Publish MQTT message
   */
  publish(topic: string, payload: string, retain = false, qos: 0 | 1 | 2 = 1): void {
    if (!this.client || !this.isConnected) {
      console.warn('[MQTT] Cannot publish, not connected');
      return;
    }

    this.client.publish(topic, payload, { qos, retain }, (error) => {
      if (error) {
        console.error('[MQTT] Publish error:', topic, error);
      }
    });
  }

  /**
   * Unsubscribe from MQTT topic
   */
  unsubscribe(topic: string): void {
    if (!this.client) return;
    
    this.client.unsubscribe(topic, (error) => {
      if (error) {
        console.error('[MQTT] Unsubscribe error:', topic, error);
      } else {
        console.log('[MQTT] Unsubscribed from:', topic);
      }
    });
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register event handler (for specific MQTT topics treated as events)
   */
  on(eventName: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(handler);

    return () => {
      const handlers = this.eventHandlers.get(eventName);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event (for compatibility, not used in pure MQTT)
   */
  emit(eventName: string, data?: unknown): void {
    console.warn('[MQTT] emit() is deprecated in pure MQTT mode. Use publish() instead.');
  }

  /**
   * Disconnect from broker
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        try {
          // Force disconnect without reconnecting (true = force)
          this.client.end(true, {}, () => {
            this.isConnected = false;
            this.client = null;
            console.log('[MQTT] Disconnected');
            resolve();
          });
        } catch (error) {
          console.error('[MQTT] Disconnect error:', error);
          this.isConnected = false;
          this.client = null;
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  /**
   * Trigger registered event handlers
   */
  private triggerEvent(eventName: string, data: unknown): void {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

// Export singleton instance
export const mqttRealtime = new MqttRealtimeService();
export default mqttRealtime;
