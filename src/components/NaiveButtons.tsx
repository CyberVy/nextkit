// this file defines some naive buttons

"use client"

import { ButtonInputs } from "@/infra/types"
import { vibrate } from "@/infra/device.client"

function Button({ width,height,icon,callback }: ButtonInputs){

    if (!width){
        width = "56px"
    }
    if (!height){
        height = "28px"
    }

    return (
        <button
            className={`relative focus-visible:outline-none focus-visible:shadow-[0_0_10px_1px_#aaaaaa] transition-shadow duration-200 ease-in-out select-none overflow-x-auto overflow-y-hidden bg-[#101010] border border-gray-300/20  rounded-lg hover:cursor-pointer hover:bg-[#303030] active:bg-[#303030] active:text-gray-200/70 active:border-gray-300/40`}
            style={{width:width, height:height}}
            onClick={event => {
                vibrate()
                callback(event)
            }}
        >
            <span className={"absolute -translate-x-1/2 -translate-y-1/2"}>
                {icon}
            </span>
        </button>
    )
}
export { Button }