import React from "react"

export type AutoSubmitStringInputInputs = {
    default_value?: string
    callback: (url: string) => void
    description: string
    need_button?: boolean
    enable_auto_execution?: boolean
}

export type ListToButtonsInputs = {
    list: string[]
    callback?: (item: string | null) => void
}

export type LabeledImageInputs = Omit<React.ComponentPropsWithoutRef<"div">, "children"> & {
    src?: string
    top_information?: React.ReactNode
    top_information_background_color?: string
    bottom_information?: React.ReactNode
    bottom_information_background_color?: string
    image_proxy_api?: string
    image_props?: Omit<React.ComponentPropsWithoutRef<"img">, "children" | "src" | "alt" | "className">
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
    intersection_root_element_ref?: React.RefObject<HTMLElement | null>
    className?: string
}

export type NaiveButtonInputs = {
    width?: string
    height?: string
    icon: React.ReactNode
    callback: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export type ButtonGroupInputs = {
    button_icons: React.ReactNode[]
    callbacks?: (() => void)[]
    item_width: string
    height: string
    default_selected_index?: number
    enable_selected_border?: boolean
}
