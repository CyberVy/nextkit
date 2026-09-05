"use client"

import { useEffect, useState } from "react"
import { is_ios_device, get_image_url_with_fallback } from "@/infra"
import type { CoverImageOptions } from "@/infra"

import { ContextMenu } from "@/components/composite/ContextMenuContainer"
import type { ContextMenuProps } from "@/components/composite/ContextMenuContainer"
import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ReactNode } from "react"

export type LabeledImageProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    src?: string
    top_information?: ReactNode
    top_information_background_color?: string
    bottom_information?: ReactNode
    bottom_information_background_color?: string
    image_proxy_api?: string
    image_props?: Omit<ComponentPropsWithoutRef<"img">, "children" | "src" | "alt" | "className" | "onClick" | "onContextMenu" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave" | "onTouchEnd">
    image_class_name?: string
    label_left?: ReactNode
    label_left_background_color?: string
    label_right?: ReactNode
    label_right_background_color?: string
    alt?: string
    on_click_image?: () => void
    context_menu?: Omit<ContextMenuProps, "children" | "disabled" | "on_click_trigger">
    className?: string
    generated_cover_options?: CoverImageOptions
}

function LabeledImage({
    src,
    label_left,
    label_left_background_color,
    label_right,
    label_right_background_color,
    alt,
    top_information,
    top_information_background_color,
    bottom_information,
    bottom_information_background_color,
    on_click_image,
    image_proxy_api,
    context_menu,
    image_props,
    image_class_name,
    className,
    generated_cover_options,
    ref,
    ...props
}: LabeledImageProps){
    const [is_ios, set_is_ios] = useState(false)
    const [is_loaded, set_is_loaded] = useState(false)

    const requested_src = src ? `${image_proxy_api || ""}${src}` : undefined
    const resolved_src = get_image_url_with_fallback(requested_src, alt, generated_cover_options)

    useEffect(() => {
        set_is_ios(is_ios_device())
    }, [])

    return (
        <ContextMenu
            sections={context_menu?.sections || []}
            {...context_menu}
            className={className}
            ref={ref}
        >
            <div
                className="select-none cursor-default w-full h-full"
                {...props}
            >
                <div className="w-full h-full relative">
                    <img
                        {...image_props}
                        alt={alt || ""}
                        src={resolved_src}
                        className={`${image_class_name || ""} w-full h-full object-cover [-webkit-touch-callout:none] ${is_ios ? "[-webkit-user-drag:none]" : ""}`}
                        onLoad={event => {
                            set_is_loaded(true)
                            image_props?.onLoad?.(event)
                        }}
                        onError={event => {
                            image_props?.onError?.(event)
                            set_is_loaded(true)
                        }}
                        onClick={() => {
                            on_click_image?.()
                        }}
                    />

                    {label_left != null && <div
                        className={`absolute top-1 left-1 px-2 text-white text-xs font-bold rounded-md ${label_left_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                    >
                        {label_left}
                    </div>}

                    {label_right != null && <div
                        className={`absolute top-1 right-2 px-2 text-white text-xs font-bold rounded-md ${label_right_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                    >
                        {label_right}
                    </div>}

                    {top_information != null && <div
                        className={`absolute ${label_left ? "top-6" : "top-1"} left-1 px-1 text-pink-50 text-xs rounded-md ${top_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden max-h-12 max-w-1/2`}
                    >
                        {top_information}
                    </div>}

                    {bottom_information != null && <div
                        className={`absolute bottom-1 left-1 px-1 text-pink-50 text-xs rounded-md ${bottom_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden  max-h-4 max-w-4/5`}
                    >
                        {bottom_information}
                    </div>}
                </div>
            </div>
        </ContextMenu>
    )
}

export { LabeledImage }
