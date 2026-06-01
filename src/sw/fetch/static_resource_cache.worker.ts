import { static_resource_cache_name, is_dev, get_relative_links_from_html_string } from "@/infra/version"
import { CacheStorageItemController } from "@/infra/storage.client"

const static_resource_cache = new CacheStorageItemController(static_resource_cache_name)

export async function update(){

    const latest_index_html_response = await fetch("/")
    if (latest_index_html_response.status !== 200) return

    const latest_index_html_text = await latest_index_html_response.clone().text()

    const keys = await static_resource_cache.keys
    if (!keys) return

    for (const key of keys){
        const url = new URL(key.url)
        if (url.pathname === "/"){
            const cached_index_html_response = await static_resource_cache.get(key)
            if (!cached_index_html_response) break

            const cached_index_html_text = await cached_index_html_response.text()
            if (latest_index_html_text !== cached_index_html_text){
                static_resource_cache.delete(key)
                static_resource_cache.set(key, latest_index_html_response).then(() => console.log(`SW: Updated /.`))

                const latest_relative_links = get_relative_links_from_html_string(latest_index_html_text)
                const cached_relative_links: string[] = []
                for (const key of keys){
                    cached_relative_links.push(new URL(key.url).pathname + new URL(key.url).search)
                }

                // delete legacy assets
                // warning: all assets not in "/" will be deleted.
                setTimeout(() => {
                    cached_relative_links.forEach(async(link, index) => {
                        if (!latest_relative_links.includes(link)){
                            // do not check "/" here because it has already been checked
                            if (link === "/" || link.startsWith("/?")) return
                            
                            static_resource_cache.delete(keys[index]).then(r => {
                                if (r) return
                                return static_resource_cache.delete(keys[index].url)
                                
                            }).then(() => console.log(`SW: The legacy asset(${link}) is deleted.`))
                        }
                    })
                }, 1500)

                // silent update
                latest_relative_links.forEach(async(link) => {
                    if (!cached_relative_links.includes(link)){
                        fetch(link).then(link_response => {
                            static_resource_cache.set(new URL(link, location.origin), link_response)
                        }).then(() => console.log(`SW: Updated ${link}.`))
                    }
                })
            }
            break
        }
    }
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

    if (url.pathname === "/"){
        update()
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
