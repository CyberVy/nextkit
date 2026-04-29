export type WindowHubSendOptions = Record<string, never>

export type WindowHubMessageHandler<TData = unknown> = (data: TData, sender: string) => void

export type WindowHubMessenger<TData = unknown> = {
    send: (target_id: string, data: TData, options?: WindowHubSendOptions) => Promise<void>
    onMessage: (handler: WindowHubMessageHandler<TData>) => () => void
    close: () => Promise<void>
}

export type WindowHubIncomingEnvelope<TData = unknown> = {
    receiver_id: string
    sender: string
    data: TData
}
