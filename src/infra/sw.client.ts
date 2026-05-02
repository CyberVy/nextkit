import { is_service_worker_available } from "@/infra/device.client"

export function send_response_to_service_worker(url: string, content: string, headers: Record<string, string>, description: string){
    if (!is_service_worker_available()){
        return
    }
    const channel = new MessageChannel()
    navigator.serviceWorker.controller?.postMessage({
        url: decodeURI(url),
        content: content,
        headers: headers,
        description: description
    }, [channel.port2])


    return new Promise<boolean>((resolve) => {
        let is_resolved = false
        channel.port1.onmessage = event => {
            is_resolved = true
            resolve(event.data.ok)
            channel.port1.close()
        }
        setTimeout(() => {
            if (is_resolved) return

            channel.port1.onmessage = null
            resolve(false)
            channel.port1.close()
        }, 5000)
    })
}
