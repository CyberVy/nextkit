import React from "react"
import type { VerticalMenuBarProps } from "@/components/VerticalMenuBar"

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

export type ListToButtonsProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    list: string[]
    callback?: (item: string | null) => void
}

export type LabeledImageProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    src?: string
    top_information?: React.ReactNode
    top_information_background_color?: string
    bottom_information?: React.ReactNode
    bottom_information_background_color?: string
    image_proxy_api?: string
    image_props?: Omit<React.ComponentPropsWithoutRef<"img">, "children" | "src" | "alt" | "className" | "onClick" | "onContextMenu" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave" | "onTouchEnd">
    image_className?: string
    label_left?: React.ReactNode
    label_left_background_color?: string
    label_right?: React.ReactNode
    label_right_background_color?: string
    alt?: string
    description?: React.ReactNode
    onClickImage?: () => void
    onClickDelete?: () => void
    clear_margin?: number
    protected_padding?: number
    intersection_root_element?: HTMLElement | null
    context_menu?: Pick<VerticalMenuBarProps, "sections" | "header" | "footer" | "compact" | "accent_color" | "enable_vibration" | "onSelect"> & {
        long_press_ms?: number
        close_after_select?: boolean
    }
    className?: string
}

export type ScrollButtonProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    element_ref?: React.RefObject<HTMLDivElement | null>
    callback?: () => void
    position_class_name?: string
}

export type SearchWordInputProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    callback: (word: string) => void
    description?: string
}

export type ButtonGroupProps = Omit<React.ComponentPropsWithRef<"div">, "children"> & {
    button_icons: React.ReactNode[]
    callbacks?: (() => void)[]
    item_width: string
    height: string
    default_selected_index?: number
    enable_selected_border?: boolean
    background_color?: string
    background_color_dark?: string
    border_color?: string
    border_color_dark?: string
    text_color?: string
    text_color_dark?: string
    selected_background_color?: string
    selected_background_color_dark?: string
    selected_border_color?: string
    selected_border_color_dark?: string
    selected_text_color?: string
    selected_text_color_dark?: string
}

export type NaiveButtonProps = Omit<React.ComponentPropsWithRef<"button">, "children"> & {
    width?: string
    height?: string
    icon: React.ReactNode
    callback?: (event: React.MouseEvent<HTMLButtonElement>) => void
    background_color?: string
    background_color_dark?: string
    border_color?: string
    border_color_dark?: string
    text_color?: string
    text_color_dark?: string
}
