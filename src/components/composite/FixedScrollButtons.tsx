"use client"

import { ButtonGroup } from "@/components/base/Buttons"
import { string_icons } from "@/infra/ui_constants"
import React from "react"
import { vibrate } from "@/infra/device.client"
import { join_classes } from "../utils"

import type { ComponentPropsWithRef, RefObject } from "react"

export type ScrollButtonProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    element_ref?: RefObject<HTMLDivElement | null>
    callback?: () => void
    position_class_name?: string
}

const scroll_button_group_props = {
    item_width: "40px",
    height: "40px",
    enable_selected_border: false,
    background_color: "rgba(244,244,244,0.40)",
    background_color_dark: "rgba(24,24,24,0.40)",
    border_color: "rgba(0,0,0,0.10)",
    border_color_dark: "rgba(255,255,255,0.10)",
    text_color: "rgba(48,48,48,0.80)",
    text_color_dark: "rgba(255,255,255,0.80)",
    selected_background_color: "rgba(0,0,0,0)",
    selected_background_color_dark: "rgba(255,255,255,0)",
    selected_border_color: "rgba(0,0,0,0.10)",
    selected_border_color_dark: "rgba(255,255,255,0.10)",
    selected_text_color: "rgba(48,48,38,0.95)",
    selected_text_color_dark: "rgba(244,244,244,0.95)",
}

function scroll_element({ element_ref, callback }: ScrollButtonProps, position: "top" | "bottom"){
    vibrate()
    if (!element_ref?.current){
        const { documentElement } = document
        // use window.outerHeight
        // or use window.innerHeight instead of documentElement.clientHeight
        // to get the correct viewport height with
        // css: min-height: calc(100% + env(safe-area-inset-top) + env(safe-area-inset-bottom));
        // for Apple Webkit
        // https://bugs.webkit.org/show_bug.cgi?id=210009
        documentElement.scrollTop = position === "top" ? 0 : documentElement.scrollHeight - window.innerHeight - 1
        callback?.()
        return
    }

    element_ref.current.scrollTop = position === "top" ? 0 : element_ref.current.scrollHeight - element_ref.current.clientHeight - 1
    callback?.()
}

const ScrollToTopButton = React.memo(function ScrollToTopButton({ element_ref, callback, position_class_name, className, ref, ...props }: ScrollButtonProps){
    return (
        <div
            {...props}
            ref={ref}
            className={join_classes("fixed z-10 select-none text-2xl", position_class_name || "bottom-4 right-4", className)}
        >
            <ButtonGroup
                button_icons={[string_icons.up_triangle]}
                callbacks={[() => scroll_element({ element_ref, callback }, "top")]}
                {...scroll_button_group_props}
            />
        </div>
    )
})

const ScrollToBottomButton = React.memo(function ScrollToBottomButton({ element_ref, callback, position_class_name, className, ref, ...props }: ScrollButtonProps){
    return (
        <div
            {...props}
            ref={ref}
            className={join_classes("fixed z-10 select-none text-2xl", position_class_name || "bottom-4 right-17", className)}
        >
            <ButtonGroup
                button_icons={[string_icons.down_triangle]}
                callbacks={[() => scroll_element({ element_ref, callback }, "bottom")]}
                {...scroll_button_group_props}
            />
        </div>
    )
})

const ScrollButtonGroup = React.memo(function ScrollButtonGroup ({ element_ref, callback, position_class_name, className, ref, ...props }: ScrollButtonProps){
    return (
        <div
            {...props}
            ref={ref}
            className={join_classes("fixed z-10 select-none text-2xl", position_class_name || "bottom-4 right-4", className)}
        >
            <ButtonGroup
                button_icons={[string_icons.up_triangle, string_icons.down_triangle]}
                callbacks={[
                    () => scroll_element({ element_ref, callback }, "top"),
                    () => scroll_element({ element_ref, callback }, "bottom")
                ]}
                {...{ ...scroll_button_group_props, item_width: "52px" }}
            />
        </div>
    )
})

ScrollToTopButton.displayName = "ScrollToTopButton"
ScrollToBottomButton.displayName = "ScrollToBottomButton"
ScrollButtonGroup.displayName = "ScrollButtonGroup"

export { ScrollToTopButton, ScrollToBottomButton, ScrollButtonGroup }
