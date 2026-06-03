import { static_resource_cache_name, is_dev } from "@/infra/version"
import { CacheStorageItemController } from "@/infra/storage.client"
import { update } from "@/infra/version"

const static_resource_cache = new CacheStorageItemController(static_resource_cache_name)

export function handle_fetch_for_static_resource(event: FetchEvent){

    if (is_dev) return false

    if (event.request.method !== "GET") return false

    const url = new URL(event.request.url)
    const included_path_prefix_list = ["/"]
    let is_included = false

    // do not cache the resource of the other sites
    if (url.hostname !== location.hostname) return false
    // do not cache the service worker script
    if (url.href === location.href) return false

    for (const path of included_path_prefix_list){
        if (url.pathname.startsWith(path)){
            is_included = true
            break
        }
    }
    if (!is_included) return false

    if (url.pathname === "/"){
        update(static_resource_cache)
    }

    const f = async () => {
        const cached = await static_resource_cache.get(event.request) || await static_resource_cache.get(event.request.url)
        if (cached){
            return cached
        }
        const response = await fetch(event.request)
        if (response.status === 200){
            await static_resource_cache.set(event.request, response.clone())
        }
        return response
    }
    event.respondWith(f())
    return true
}
