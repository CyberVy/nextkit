import version, { static_resource_cache_name, is_later_version } from "@/infra/version"

export async function check_latest_with_cache(delete_legacy? :boolean){
    let is_latest = true
    const cache_keys = await caches.keys()
    for (const key of cache_keys){
        if (!key.startsWith(static_resource_cache_name)) continue

        const cache_version = key.split(`${static_resource_cache_name}-v`)[1]
        if (is_later_version(cache_version,version)){
            is_latest =  true
            break
        }
        if (is_later_version(version, cache_version)) {
            is_latest = false
            if (delete_legacy){
                await caches.delete(key)
                console.log(`The static resource cache(${key}) is deleted.`)
            }
        }
    }
    return is_latest
}


export function handle_fetch_for_static_resource(event: FetchEvent){

    try {
        if (process.env.NODE_ENV === "development") return false
    }
    catch {}

    if (event.request.method !== "GET") return false

    const url = new URL(event.request.url)
    const included_path_prefix_list = ["/"]
    let is_included = false

    // do not cache the resource of the other sites
    if (url.hostname !== location.hostname) return false
    // do not cache the service worker script
    if (url.href === location.href) return false

    for (const path of included_path_prefix_list) {
        if (url.pathname.startsWith(path)){
            is_included = true
            break
        }
    }
    if (!is_included) return false

    const f = async () => {
        const latest_cache_key = `${static_resource_cache_name}-v${version}`
        const static_resource_cache = await caches.open(latest_cache_key)
        const cached = await static_resource_cache.match(event.request)
        if (cached) {
            if (url.pathname !== "/")
                return cached
            else {
                if (await check_latest_with_cache(true)){
                    return cached
                }
            }
        }
        const response = await fetch(event.request)
        if (response.status === 200) {
            await static_resource_cache.put(event.request, response.clone())
        }
        return response
    }
    event.respondWith(f())
    return true
}