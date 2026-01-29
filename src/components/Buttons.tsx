// this file defines some naive buttons

"use client"

import { ButtonGroupInputs, NaiveButtonInputs } from "@/infra/types"
import { vibrate } from "@/infra/device.client"
import { useState } from "react"


function NaiveButton({ width,height,icon,callback }: NaiveButtonInputs){

    if (!width){
        width = "56px"
    }
    if (!height){
        height = "28px"
    }

    return (
        <button
            className={`relative focus-visible:outline-none align-middle focus-visible:shadow-[0_0_10px_1px_#aaaaaa] transition-shadow duration-200 ease-in-out select-none overflow-x-auto overflow-y-hidden bg-[#101010] border border-gray-300/20  rounded-lg hover:cursor-pointer hover:bg-[#303030] active:bg-[#303030] active:text-gray-200/70 active:border-gray-300/40`}
            style={{width:width, height:height}}
            onClick={event => {
                vibrate()
                callback(event)
            }}
        >
            <span className={"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}>
                {icon}
            </span>
        </button>
    )
}

function ButtonGroup({button_icons,callbacks,item_width,height,default_selected_index,enable_selected_border}: ButtonGroupInputs){
    enable_selected_border = enable_selected_border == undefined ? true : enable_selected_border
    const [selected_index,set_selected_index] = useState(default_selected_index || -1)
    return (
        <div
            className="inline-block select-none border border-gray-300/20 rounded-xl bg-[#101010]"
        >
            {button_icons.map((icon,index) => {
                return (
                    <button
                        className={`relative align-middle ${index !== 0 ? "ml-[-4px]" : ""} px-4 bg-black/0 ${selected_index === index && enable_selected_border ? "ring ring-gray-300/50" : ""} rounded-xl hover:cursor-pointer transition duration-300  active:text-gray-200/70`}
                        key={index}
                        onClick={() => {
                            vibrate()
                            if (index !== selected_index) {
                                set_selected_index(index)
                                callbacks?.[index]?.()
                            }
                            else {
                                set_selected_index(-1)
                                callbacks?.[index]?.()
                            }
                        }}
                        style={{width:item_width, height:height}}
                    >
                        <span className={"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}>
                            {icon}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

export { NaiveButton, ButtonGroup }