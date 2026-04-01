"use client"

import { useState,useRef } from "react"
import {  string_icons } from "@/infra/ui_constants"
import type { SearchWordInputInputs, StringInputInputs } from "@/components/types"
import { search_icon } from "@/components/icons"
import { vibrate } from "@/infra/device.client"
import { NaiveButton } from "@/components/Buttons"

function StringInput({ default_value,callback,description, need_button, button_title, button_height, button_width, enable_auto_execution = true }: StringInputInputs){
    const [is_collapsed,set_is_collapsed] = useState(false)
    return (
        <div className="">
            {Boolean(need_button) && (
                <NaiveButton
                    className={"mb-2"}
                    width={button_width}
                    height={button_height}
                    icon={
                        <span>
                            {button_title} {is_collapsed ? string_icons.up_triangle : string_icons.down_triangle}
                        </span>
                    }
                    callback={() => {
                        vibrate()
                        set_is_collapsed(!is_collapsed)
                    }}
                />
            )}
            <div className={`${is_collapsed ? "hidden" : "block"} mb-1`}>
                <input
                    type="text"
                    placeholder={`${description}`}
                    defaultValue={default_value || ""}
                    onChange={enable_auto_execution ? event => {
                        callback(event.target.value)
                    } : undefined}
                    onKeyDown={event => {
                        if (event.key === "Enter"){
                            event.currentTarget.blur()
                            callback(event.currentTarget.value || "")
                        }
                    }}
                    className="focus:outline-none focus:ring-1 focus:ring-black/40 dark:focus:ring-white/40 transition-shadow duration-200 ease-in-out border border-black/20 dark:border-white/20 rounded-lg px-3 py-2 w-full"
                />
            </div>
        </div>
    )
}

function SearchWordInput({ callback }: SearchWordInputInputs){
    const input_ref = useRef<HTMLInputElement>(null)
    return (
        <div className={`px-4 py-3 flex gap-2`}>
            <input
                ref={input_ref}
                type="text"
                placeholder="Search for something? "
                className="focus:outline-none focus:shadow-[0_0_10px_1px_#aaaaaa] transition-shadow duration-200 ease-in-out border border-black/20 dark:border-white/20 rounded-lg px-3 py-2 flex-1"
                onKeyDown={event => {
                    if (event.key === "Enter"){
                        event.currentTarget.blur()
                        callback(event.currentTarget.value || "")
                    }
                }}
                onChange={event => {
                    if (event.target.value === ""){
                        callback(event.target.value)
                    }
                }}
            />

            <NaiveButton
                icon={search_icon}
                callback={() => {
                    vibrate()
                    callback(input_ref.current?.value || "")
                }}
                height={"48px"}
            />
        </div>
    )
}

export { StringInput, SearchWordInput }
