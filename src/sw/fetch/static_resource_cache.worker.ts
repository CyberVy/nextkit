import version, { static_resource_cache_name, is_dev } from "@/infra/version"
import { CacheStorageItemController } from "@/infra/storage.client"

export async function check_latest(){
    let is_latest = true

    const latest_index_html_response = await fetch("/")
    if (latest_index_html_response.status !== 200) return true

    const latest_index_html_text = await latest_index_html_response.text()

    const cache_keys = await caches.keys()
    for (const key of cache_keys){
        if (!key.startsWith(static_resource_cache_name)) continue

        const cache_controller = new CacheStorageItemController(key)
        const _keys = await cache_controller.keys
        if (_keys){
            for (const _key of _keys){
                if (new URL(_key.url).pathname === "/"){
                    const cached_index_html_response = await cache_controller.get(_key)

                    if (!cached_index_html_response) break

                    if (latest_index_html_text !== await cached_index_html_response.text()){
                        await cache_controller.destroy()
                        is_latest = false
                        console.log(`The static resource cache(${key}) is deleted.`)
                    }
                    break
                }
            }
        }
    }
    return is_latest
}


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

    const f = async () => {
        const latest_cache_key = `${static_resource_cache_name}-v${version}`
        const static_resource_cache = new CacheStorageItemController(latest_cache_key)
        const cached = await static_resource_cache.get(event.request)
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
    if (url.pathname === "/"){
        // avoid resources racing
        setTimeout(() => check_latest(), 500)
    }
    return true
}