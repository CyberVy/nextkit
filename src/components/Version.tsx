"use client"

import version, { delete_static_resource_caches_of_all_versions } from "@/infra/version"
import { string_icons } from "@/infra/custom_ui_constants"
import { useState } from "react"
import { vibrate } from "@/infra/device.client"

function Version(){
    const [clear_cache_icon, set_cache_icon] = useState(string_icons.del)

    return (
        <div>
            <span className={"text-xs"}>
                v{version}
            </span>
            <button
                className={"ml-1 text-xs hover:cursor-pointer text-red-400 rounded-md"}
                onClick={() => {
                    vibrate()
                    set_cache_icon(string_icons.success)
                    delete_static_resource_caches_of_all_versions()
                        .then(() => setTimeout(() => set_cache_icon(string_icons.del), 2000))
                }}
            >
                {clear_cache_icon}
            </button>
        </div>
    )
}
export { Version }