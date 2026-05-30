"use client"

import { is_ios_device } from "@/infra"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"

export type IOSHapticsContainerProps = {
    children: ReactNode
}

function IOSHapticsContainer({ children }: IOSHapticsContainerProps){
    const [is_in_ios_device, set_is_in_ios_deivce] = useState(false)
    useEffect(() => {
        set_is_in_ios_deivce(is_ios_device())
    }, [])
    if (is_in_ios_device){
        return (
            <label>
                <input
                    onClick={event => event.stopPropagation()}
                    onTouchStart={event => event.stopPropagation()}
                    onTouchMove={event => event.stopPropagation()}
                    onTouchCancel={event => event.stopPropagation()}
                    onTouchEnd={event => event.stopPropagation()}
                    onTouchCancelCapture={event => event.stopPropagation()}
                    onTouchEndCapture={event => event.stopPropagation()}
                    onTouchMoveCapture={event => event.stopPropagation()}
                    onTouchStartCapture={event => event.stopPropagation()}
                    onPointerDown={event => event.stopPropagation()}
                    onPointerMove={event => event.stopPropagation()}
                    onPointerCancel={event => event.stopPropagation()}
                    onPointerEnter={event => event.stopPropagation()}
                    onPointerLeave={event => event.stopPropagation()}
                    onPointerCancelCapture={event => event.stopPropagation()}
                    onPointerDownCapture={event => event.stopPropagation()}
                    onPointerMoveCapture={event => event.stopPropagation()}
                    onPointerOut={event => event.stopPropagation()}
                    onPointerOutCapture={event => event.stopPropagation()}
                    onPointerOver={event => event.stopPropagation()}
                    onPointerOverCapture={event => event.stopPropagation()}
                    onPointerUp={event => event.stopPropagation()}
                    onPointerUpCapture={event => event.stopPropagation()}
                    ref={(node) => {
                        if (!node) return
                        node.setAttribute("switch", "")
                    }}
                    type="checkbox"
                    className="hidden"
                />
                {children}
            </label>
        )
    }
    else{
        return children
    }
}

export { IOSHapticsContainer }
