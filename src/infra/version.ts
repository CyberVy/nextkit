export const is_dev = process.env.NODE_ENV === "development"
import { version as package_version } from "../../package.json"
import type { CacheStorageItemController } from "./storage.client"
const version = `${package_version}${is_dev ? "dev" : ""}`
export default version
export const static_resource_cache_name = "static-resource-cache"
export async function update(static_resource_cache: CacheStorageItemController){

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
                static_resource_cache.set(key, latest_index_html_response).then(() => console.log(`Update: Updated /.`))

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
                                
                            }).then(() => console.log(`Update: The legacy asset(${link}) is deleted.`))
                        }
                    })
                }, 1500)

                // silent update
                latest_relative_links.forEach((link) => {
                    if (!cached_relative_links.includes(link)){
                        fetch(link).then(link_response => {
                            if (link_response.status === 200){
                                static_resource_cache.set(new URL(link, location.origin), link_response)
                                    .then(() => console.log(`Update: Updated ${link}.`))
                            } 
                            else {
                                console.warn(`Update: Skip caching failed response for ${link} (status: ${link_response.status})`)
                            }
                        }).catch(err => {
                            console.error(`Update: Failed to update asset ${link}:`, err)
                        })
                    }
                })
            }
            break
        }
    }
}

export function is_later_version(v1:string, v2:string){
    const [maj_1_str, min_1_str, patch_1_str] = v1.split('.')
    const [maj_2_str, min_2_str, patch_2_str] = v2.split('.')

    const maj_1 = parseInt(maj_1_str)
    const min_1 = parseInt(min_1_str)
    const patch_1 = parseInt(patch_1_str)
    const maj_2 = parseInt(maj_2_str)
    const min_2 = parseInt(min_2_str)
    const patch_2 = parseInt(patch_2_str)

    if (maj_1 > maj_2){
        return true
    }
    else if (maj_1 < maj_2){
        return false
    }
    if (min_1 > min_2){
        return true
    }
    else if (min_1 < min_2){
        return false
    }
    return patch_1 > patch_2
}

export function get_relative_links_from_html_string(html: string){

    let matches = [...html.matchAll(/"(\/(?!>).+?)"/g)].map(m => m[1])
    matches =  matches.map(v => {
        if (v.endsWith("\\")){
            v = v.slice(0, -1)
        }
        return v
    })
    return [...new Set(matches)]
}
