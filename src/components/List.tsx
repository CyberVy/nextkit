"use client"

import { useState } from "react"
import { highlight, string_icons } from "@/infra/custom_ui_constants"
import type { ListToButtonsInputs } from "@/infra/types"
import { vibrate } from "@/infra/device.client"

function ListToButtons({ list, callback }: ListToButtonsInputs) {

    const [selected_item,set_selected_item] = useState<string | number | null>(null)
    const [is_collapsed,set_is_collapsed] = useState(true)
    const default_item_style = "px-2 py-1  rounded-xl border border-gray-300/20 hover:bg-zinc-600"
    const selected_item_style = `px-2 py-1 rounded-xl ${highlight} border border-gray-300/20 hover:bg-zinc-600`

    return (
        <div className="select-none">
            <button className={`text-2xl px-2 border-gray-300/20 hover:cursor-pointer border rounded-xl`}
                onClick={() => {
                    vibrate()
                    set_is_collapsed(!is_collapsed)
                }}
            >
                <span className={`${selected_item ? highlight : ""}`}>
                    {string_icons.menu} {is_collapsed ? string_icons.down_triangle : string_icons.up_triangle} {list.length}
                </span>
            </button>

            {<div className={`flex flex-wrap text-xs gap-1 py-2 pl-2 pr-2 max-h-[100px] overflow-y-auto ${is_collapsed ? 'hidden' : 'block'}`}>
                {list.map((item, index) => (
                    <button
                        key={index}
                        className={item === selected_item ? selected_item_style : default_item_style}
                        onClick={event => {
                            vibrate()
                            set_selected_item(item === selected_item ? null : item)
                            callback?.(item === selected_item ? null : item)
                        }}
                    >
                        {item}
                    </button>
                ))}
            </div>}
        </div>
    )}


export { ListToButtons }
