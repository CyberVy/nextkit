"use client"

import { useRef, useState } from "react"
import {  string_icons } from "@/components/ui_constants"
import { SearchIcon } from "@/components/icons"
import { vibrate } from "@/infra/device.client"
import { NaiveButton } from "@/components/base/Buttons"

export type SearchWordInputProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    callback: (word: string) => void
    description?: string
}

export type StringInputProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    default_value?: string
    callback: (url: string) => void
    description: string
    need_button?: boolean
    button_title?: string
    button_height?: string
    button_width?: string
    enable_auto_execution?: boolean
}

function StringInput({
    default_value,
    callback,
    description,
    need_button,
    button_title,
    button_height,
    button_width,
    enable_auto_execution = true,
    className = "",
    ref,
    ...props
}: StringInputProps){
    const [is_collapsed, set_is_collapsed] = useState(false)
    return (
        <div
            {...props}
            ref={ref}
            className={className}
        >
            {Boolean(need_button) && (
                <NaiveButton
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
                    className="focus:outline-none focus:ring-1 focus:ring-black/40 dark:focus:ring-white/40 transition-shadow duration-300 ease-in-out border border-black/20 dark:border-white/20 rounded-lg px-3 py-2 w-full"
                />
            </div>
        </div>
    )
}

function SearchWordInput({ callback, className = "", description = "", ref, ...props }: SearchWordInputProps){
    description = description || "Search for something? "
    const input_ref = useRef<HTMLInputElement>(null)
    return (
        <div
            {...props}
            ref={ref}
            className={`flex gap-2 ${className}`}
        >
            <input
                ref={input_ref}
                type="text"
                placeholder={description}
                className="focus:outline-none focus:ring-1 focus:ring-black/40 dark:focus:ring-white/40 transition-shadow duration-300 ease-in-out border border-black/20 dark:border-white/20 rounded-lg px-3 py-2 flex-1"
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
                icon={<SearchIcon />}
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
