"use client"

import { ButtonGroup } from "@/components/base/Buttons"
import { string_icons } from "@/components/ui_constants"
import React from "react"
import { join_classes } from "../utils"

import type { ComponentPropsWithRef, RefObject } from "react"

export type ScrollButtonProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    element_ref?: RefObject<HTMLDivElement | null>
    on_scroll?: () => void
    offset?: number
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

function scroll_element({ element_ref, on_scroll, offset = 0 }: ScrollButtonProps, position: "top" | "bottom"){
    if (!element_ref?.current){
        const { documentElement } = document
        // use window.outerHeight
        // or use window.innerHeight instead of documentElement.clientHeight
        // to get the correct viewport height with
        // css: min-height: calc(100% + env(safe-area-inset-top) + env(safe-area-inset-bottom));
        // for Apple Webkit
        // https://bugs.webkit.org/show_bug.cgi?id=210009
        documentElement.scrollTop = position === "top" ? 0 + offset : documentElement.scrollHeight - window.innerHeight - offset
        on_scroll?.()
        return
    }

    element_ref.current.scrollTop = position === "top" ? 0 + offset : element_ref.current.scrollHeight - element_ref.current.clientHeight - offset
    on_scroll?.()
}

const ScrollToTopButton = React.memo(function ScrollToTopButton({ element_ref, on_scroll, offset = 1, className, ref, ...props }: ScrollButtonProps){
    return (
        <div
            {...props}
            ref={ref}
            className={join_classes("fixed z-10 select-none text-2xl", className)}
        >
            <ButtonGroup
                button_icons={[string_icons.up_triangle]}
                on_clicks={[() => scroll_element({ element_ref, on_scroll, offset }, "top")]}
                {...scroll_button_group_props}
            />
        </div>
    )
})

const ScrollToBottomButton = React.memo(function ScrollToBottomButton({ element_ref, on_scroll, offset = 1, className, ref, ...props }: ScrollButtonProps){
    return (
        <div
            {...props}
            ref={ref}
            className={join_classes("fixed z-10 select-none text-2xl", className)}
        >
            <ButtonGroup
                button_icons={[string_icons.down_triangle]}
                on_clicks={[() => scroll_element({ element_ref, on_scroll, offset }, "bottom")]}
                {...scroll_button_group_props}
            />
        </div>
    )
})

const ScrollButtonGroup = React.memo(function ScrollButtonGroup ({ element_ref, on_scroll, offset = 0, className, ref, ...props }: ScrollButtonProps){
    return (
        <div
            {...props}
            ref={ref}
            className={join_classes("fixed z-10 select-none text-2xl", className)}
        >
            <ButtonGroup
                button_icons={[string_icons.up_triangle, string_icons.down_triangle]}
                on_clicks={[
                    () => scroll_element({ element_ref, on_scroll, offset }, "top"),
                    () => scroll_element({ element_ref, on_scroll, offset }, "bottom")
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
