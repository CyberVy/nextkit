"use client"

import type { ButtonGroupProps, NaiveButtonProps } from "@/components/types"
import { vibrate } from "@/infra/device.client"
import { useState, type CSSProperties } from "react"
import { join_classes } from "../utils"

function NaiveButton({
    width = "56px",
    height = "32px",
    icon,
    callback,
    background_color = "rgba(244,244,244,0.40)",
    background_color_dark = "rgba(24,24,24,0.40)",
    border_color = "rgba(0,0,0,0.10)",
    border_color_dark = "rgba(255,255,255,0.10)",
    text_color = "rgba(48,48,48,0.80)",
    text_color_dark = "rgba(255,255,255,0.80)",
    className,
    style,
    ref,
    ...props
}: NaiveButtonProps){

    return (
        <div 
            className={join_classes(
                "inline-block select-none backdrop-blur-xl",
                "border rounded-[18px]",
                "bg-(--button-background-color) text-(--button-text-color) border-(--button-border-color)",
                "shadow-[0_6px_18px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.28)]",
                "transition duration-300 ease-in-out",
                "hover:cursor-pointer hover:shadow-[0_8px_22px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.28)]",
                "active:scale-[0.97] active:text-black/44",
                "dark:bg-(--button-background-color-dark) dark:text-(--button-text-color-dark) dark:border-(--button-border-color-dark)",
                "dark:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:shadow-[0_10px_24px_rgba(120,120,120,0.10),inset_0_1px_0_rgba(255,255,255,0.3)] dark:active:text-white/44",
                className
            )}
            ref={ref}
            style={{
                width: width,
                height: height,
                "--button-background-color": background_color,
                "--button-background-color-dark": background_color_dark,
                "--button-border-color": border_color,
                "--button-border-color-dark": border_color_dark,
                "--button-text-color": text_color,
                "--button-text-color-dark": text_color_dark,
                ...style,
            } as CSSProperties}
            {...props}
        >
            <button
                type={"button"}
                className={join_classes(
                    "relative align-middle overflow-hidden w-full h-full rounded-[18px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3a3a3]/22"
                )}
                onClick={event => {
                    vibrate()
                    callback?.(event)
                }}
            >
                <span className={"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"}>
                    {icon}
                </span>
            </button>
        </div>
    )
}

function ButtonGroup({
    button_icons,
    callbacks,
    item_width,
    height,
    default_selected_index,
    enable_selected_border,
    background_color = "rgba(244,244,244,0.40)",
    background_color_dark = "rgba(24,24,24,0.40)",
    border_color = "rgba(0,0,0,0.10)",
    border_color_dark = "rgba(255,255,255,0.10)",
    text_color = "rgba(48,48,48,0.80)",
    text_color_dark = "rgba(255,255,255,0.80)",
    selected_background_color = "rgba(0,0,0,0)",
    selected_background_color_dark = "rgba(255,255,255,0)",
    selected_border_color = "rgba(0,0,0,0.10)",
    selected_border_color_dark = "rgba(255,255,255,0.10)",
    selected_text_color = "rgba(48,48,38,0.95)",
    selected_text_color_dark = "rgba(244,244,244,0.95)",
    className,
    style,
    ref,
    ...props
}: ButtonGroupProps){
    const should_show_selected_state = enable_selected_border == undefined ? true : enable_selected_border
    const [selected_index, set_selected_index] = useState(default_selected_index ?? -1)

    return (
        <div
            {...props}
            ref={ref}
            className={join_classes(
                "inline-block select-none rounded-[22px] border p-1 backdrop-blur-2xl",
                "bg-(--button-group-background-color) border-(--button-group-border-color)",
                "shadow-[0_8px_22px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.24)]",
                "dark:bg-(--button-group-background-color-dark) dark:border-(--button-group-border-color-dark)",
                "dark:shadow-[0_10px_24px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.03)]",
                className
            )}
            style={{
                "--button-group-background-color": background_color,
                "--button-group-background-color-dark": background_color_dark,
                "--button-group-border-color": border_color,
                "--button-group-border-color-dark": border_color_dark,
                "--button-group-text-color": text_color,
                "--button-group-text-color-dark": text_color_dark,
                "--button-group-selected-background-color": selected_background_color,
                "--button-group-selected-background-color-dark": selected_background_color_dark,
                "--button-group-selected-border-color": selected_border_color,
                "--button-group-selected-border-color-dark": selected_border_color_dark,
                "--button-group-selected-text-color": selected_text_color,
                "--button-group-selected-text-color-dark": selected_text_color_dark,
                ...style,
            } as CSSProperties}
        >
            {button_icons.map((icon, index) => {
                const is_selected = should_show_selected_state && selected_index === index

                return (
                    <button
                        type="button"
                        className={join_classes(
                            "relative align-middle px-4 overflow-hidden rounded-[18px] transition duration-300 ease-in-out hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3a3a3]/22",
                            "text-(--button-group-current-text-color) dark:text-(--button-group-current-text-color-dark)",
                            is_selected
                                ? "border bg-(--button-group-selected-background-color) border-(--button-group-selected-border-color) shadow-[0_4px_12px_rgba(0,0,0,0.035),inset_0_1px_0_rgba(255,255,255,0.30)] dark:bg-(--button-group-selected-background-color-dark) dark:border-(--button-group-selected-border-color-dark) dark:shadow-[0_6px_14px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.03)]"
                                : "border border-transparent hover:shadow-[0_3px_10px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.30)] dark:hover:shadow-[0_4px_12px_rgba(120,120,120,0.30),inset_0_1px_0_rgba(255,255,255,0.10)] active:scale-[0.975] active:text-black/44 dark:active:text-white/44"
                        )}
                        key={index}
                        onClick={() => {
                            vibrate()
                            if (index !== selected_index){
                                set_selected_index(index)
                                callbacks?.[index]?.()
                            }
                            else {
                                set_selected_index(-1)
                                callbacks?.[index]?.()
                            }
                        }}
                        style={{
                            width: item_width,
                            height: height,
                            "--button-group-current-text-color": is_selected ? selected_text_color : text_color,
                            "--button-group-current-text-color-dark": is_selected ? selected_text_color_dark : text_color_dark,
                        } as CSSProperties}
                    >
                        <span className={"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"}>
                            {icon}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

export { NaiveButton, ButtonGroup }
