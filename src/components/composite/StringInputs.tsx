"use client"

import { useEffect, useState } from "react"
import { SearchIcon } from "@/components/icons"
import { vibrate } from "@/infra/device.client"
import { NaiveButton } from "@/components/base/Buttons"

export type SearchWordInputProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    on_search: (word: string) => void
    description?: string
    input_ref?: React.Ref<HTMLInputElement>
}

export type StringInputProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    value?: string
    default_value?: string
    on_change: (value: string) => void
    description: string
    enable_auto_execution?: boolean
    icon?: React.ReactNode
    input_ref?: React.Ref<HTMLInputElement>
}

function StringInput({
    value: controlled_value,
    default_value = "",
    on_change,
    description,
    enable_auto_execution = true,
    icon,
    input_ref,
    className = "",
    ref,
    ...props
}: StringInputProps){
    const [value, setValue] = useState(controlled_value !== undefined ? controlled_value : default_value)
    const [prev_controlled_value, set_prev_controlled_value] = useState(controlled_value)
    const [prev_default_value, set_prev_default_value] = useState(default_value)

    if (controlled_value !== prev_controlled_value || default_value !== prev_default_value){
        set_prev_controlled_value(controlled_value)
        set_prev_default_value(default_value)
        setValue(controlled_value !== undefined ? controlled_value : default_value)
    }

    const handle_change = (new_value: string) => {
        setValue(new_value)
        if (new_value === ""){
            on_change("")
        }
        else if (enable_auto_execution){
            on_change(new_value)
        }
    }

    const handle_clear = () => {
        vibrate()
        setValue("")
        on_change("")
    }

    const handle_key_down = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter"){
            event.currentTarget.blur()
            on_change(value)
        }
    }

    return (
        <div
            {...props}
            ref={ref}
            className={`relative flex items-center w-full ${className}`}
        >
            {icon && (
                <div className="absolute left-3 flex items-center pointer-events-none text-black/40 dark:text-white/40">
                    {icon}
                </div>
            )}
            <input
                ref={input_ref}
                type="text"
                placeholder={description}
                value={value}
                onChange={e => handle_change(e.target.value)}
                onKeyDown={handle_key_down}
                className={`w-full focus:outline-none focus:ring-2 focus:ring-black/15 dark:focus:ring-white/15 focus:border-black/30 dark:focus:border-white/30 transition-all duration-300 border border-black/15 dark:border-white/15 rounded-xl px-3 py-2.5 ${
                    icon ? "pl-9" : ""
                } ${value ? "pr-8" : ""}`}
            />
            {value && (
                <button
                    type="button"
                    onClick={handle_clear}
                    className="absolute right-3 flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-black/40 dark:text-white/40 cursor-pointer"
                >
                    ✕
                </button>
            )}
        </div>
    )
}

function SearchWordInput({ on_search, className = "", description = "", input_ref, ref, ...props }: SearchWordInputProps){
    description = description || "Search for something?"
    const [value, setValue] = useState("")

    const handle_change = (new_value: string) => {
        setValue(new_value)
        if (new_value === ""){
            on_search("")
        }
    }

    const handle_clear = () => {
        vibrate()
        setValue("")
        on_search("")
    }

    return (
        <div
            {...props}
            ref={ref}
            className={`relative flex items-center gap-2 w-full ${className}`}
        >
            <div className="relative flex-1 flex items-center">
                <input
                    ref={input_ref}
                    type="text"
                    placeholder={description}
                    value={value}
                    onChange={e => handle_change(e.target.value)}
                    onKeyDown={event => {
                        if (event.key === "Enter"){
                            event.currentTarget.blur()
                            on_search(value || "")
                        }
                    }}
                    className={`w-full focus:outline-none focus:ring-2 focus:ring-black/15 dark:focus:ring-white/15 focus:border-black/30 dark:focus:border-white/30 transition-all duration-300 border border-black/15 dark:border-white/15 rounded-xl px-3 py-2.5 ${
                        value ? "pr-8" : ""
                    }`}
                />
                {value && (
                    <button
                        type="button"
                        onClick={handle_clear}
                        className="absolute right-3 flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-black/40 dark:text-white/40 cursor-pointer"
                    >
                        ✕
                    </button>
                )}
            </div>

            <NaiveButton
                icon={<SearchIcon />}
                on_click={() => {
                    on_search(value || "")
                }}
                height="44px"
                width="44px"
                className="rounded-xl!"
            />
        </div>
    )
}

export { StringInput, SearchWordInput }
