declare module 'paho-mqtt' {
  export class Client {
    constructor(host: string, port: number, path: string, clientId: string)
    connect(options: any): void
    disconnect(): void
    subscribe(topic: string, options?: any): void
    send(message: Message): void
    onConnectionLost?: (responseObject: any) => void
    onMessageArrived?: (message: any) => void
  }

  export class Message {
    constructor(payload: string)
    destinationName: string
    qos: number
    retained: boolean
  }
}


