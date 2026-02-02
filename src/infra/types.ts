
import React from "react"

declare global {
    interface Window {
        webkit?: {
            messageHandlers?: Record<string, unknown>
        }
        __TAURI__?: unknown
        __TAURI_INTERNALS__?: unknown
    }
}

export type LabeledImageInputs = {
    src: string
    top_information?: React.ReactNode,
    top_information_background_color?: string
    bottom_information?: React.ReactNode,
    bottom_information_background_color?: string
    image_proxy_api?: string
    label_left?: React.ReactNode
    label_left_background_color?: string
    label_right?: React.ReactNode
    label_right_background_color?: string
    alt?: string
    description?: React.ReactNode
    onClickImage?: () => void
    onClickDelete?: () => void
    clear_margin?: number
    protected_padding?: number,
    intersection_root_element_ref?: React.RefObject<HTMLElement | null>
}
export type CoverImageOptions = {
    width?: number
    height?: number
    background?: string
    color?: string
    fontSize?: number
    fontFamily?: string
}
export type AutoSubmitStringInputInputs = {
    default_url?: string
    callback: (url: string) => void
    description: string
    need_button?: boolean
    enable_auto_execution?: boolean
}
export type NaiveButtonInputs = {
    width?: string
    height?: string
    icon: React.ReactNode
    callback: (event: React.MouseEvent<HTMLButtonElement>) => void
}
export type GlobalSettingButtonInputs = {
    cors_proxy: string
    cors_proxy_callback: (cors_proxy: string) => void
}
export type ListToButtonsInputs = {
    list: string[]
    callback?: (item: string | null) => void
}
export type ButtonGroupInputs = {
    button_icons: React.ReactNode[]
    callbacks?: (() => void)[]
    item_width:string
    height:string
    default_selected_index?: number
    enable_selected_border?: boolean
}
export type NestedRecordValue<T> = NestedRecord<T> | T | NestedRecordValue<T>[]
export interface NestedRecord<T> {
    [key: string]: NestedRecordValue<T>
}
