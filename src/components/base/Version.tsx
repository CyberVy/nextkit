"use client"

import version, { delete_static_resource_caches_of_all_versions } from "@/infra/version"
import { string_icons } from "@/infra/ui_constants"
import { useState, type ComponentPropsWithRef } from "react"
import { vibrate } from "@/infra/device.client"

type VersionProps = Omit<ComponentPropsWithRef<"div">, "children">

const Version = function Version({ className = "", ref, ...props }: VersionProps){
    const [clear_cache_icon, set_cache_icon] = useState(string_icons.del)

    return (
        <div
            {...props}
            ref={ref}
            className={className}
        >
            <span className={"text-xs"}>
                v{version}
            </span>
            <button
                type="button"
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
            <p className="text-xs">{`Built at: ${process.env.NEXT_PUBLIC_BUILD_TIME}`}</p>
        </div>
    )
}

Version.displayName = "Version"

export { Version }
