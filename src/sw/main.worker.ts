/// <reference lib="webworker" />

import { handle_fetch_for_static_resource } from "@/sw/fetch/static_resource_cache.worker"

const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('fetch', event => {
    if (handle_fetch_for_static_resource(event)) return
})
sw.addEventListener('install', event => sw.skipWaiting())
sw.addEventListener('activate', event => event.waitUntil(sw.clients.claim()))
