const is_dev = process.env.NODE_ENV === "development"
const version = `0.0.0${is_dev ? "dev" : ""}`
export const static_resource_cache_name = "static-resource-cache"

export async function delete_static_resource_caches_of_all_versions(){
    const cache_keys = await caches.keys()
    for (const key of cache_keys){
        if (key.startsWith(static_resource_cache_name)) {
            // delete all legacy caches
            await caches.delete(key)
            console.log(`${key} is deleted.`)
        }
    }
}

export function is_later_version(v1:string,v2:string){
    const [maj_1_str,min_1_str,patch_1_str] = v1.split('.')
    const [maj_2_str,min_2_str,patch_2_str] = v2.split('.')

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

export default version