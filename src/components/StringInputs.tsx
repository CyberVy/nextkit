"use client"

import { useState } from "react"
import { pulse, string_icons } from "@/infra/custom_ui_constants"
import type {
    AutoSubmitStringInputInputs
} from "@/infra/types"
import { vibrate } from "@/infra/device.client"

function AutoSubmitStringInput({ default_url,callback,description, need_button, enable_auto_execution }: AutoSubmitStringInputInputs){
    enable_auto_execution = enable_auto_execution == undefined ? true : enable_auto_execution
    const [is_collapsed,set_is_collapsed] = useState(false)
    return (
        <div className="">
            {Boolean(need_button) &&
                <button
                    className={`${pulse} text-lg px-2 mb-1 border border-gray-300/40 rounded-lg hover:cursor-pointer`}
                    onClick={() => {
                        vibrate()
                        set_is_collapsed(!is_collapsed)
                    }
                }>
                    {description} {is_collapsed ? string_icons.up_triangle : string_icons.down_triangle}
                </button>
            }

            <div className={`${is_collapsed ? "hidden" : "block"} mb-1`}>
                <input
                    type="text"
                    placeholder={`${description}`}
                    defaultValue={default_url || ""}
                    onChange={enable_auto_execution ? event => {
                        callback(event.target.value)
                    } : undefined}
                    onKeyDown={event => {
                        if (event.key === "Enter"){
                            event.currentTarget.blur()
                            callback(event.currentTarget.value || "")
                        }
                    }}
                    className="focus:outline-none focus:ring-1 focus:ring-white/60 transition-shadow duration-200 ease-in-out border border-gray-300/60 rounded-lg px-3 py-2 w-full"
                />
            </div>
        </div>
    )
}

export { AutoSubmitStringInput }