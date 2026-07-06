/// <reference lib="webworker" />

import { handle_fetch_for_static_resource } from "@/sw/infra/static_cache"

const sw = self as unknown as ServiceWorkerGlobalScope

function is_static_resource_request(request: Request, url: URL): boolean{
    if (url.hostname !== location.hostname) return false
    if (url.href === location.href) return false

    const pathname = url.pathname
    const included_path_prefixes = ["/"]
    return included_path_prefixes.some(prefix => pathname.startsWith(prefix))
}

sw.addEventListener('fetch', event => {
    const { request } = event
    if (request.method !== "GET") return

    const url = new URL(request.url)

    if (is_static_resource_request(request, url)){
        handle_fetch_for_static_resource(event)
        return
    }
})

sw.addEventListener('install', () => sw.skipWaiting())
sw.addEventListener('activate', event => event.waitUntil(sw.clients.claim()))
