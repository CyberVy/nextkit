"use client"

import { useEffect, useState } from "react"
import { generate_cover_image } from "@/infra/data_generation_lib"

import { is_ios_device } from "@/infra/device.client"
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
    ref,
    ...props
}: LabeledImageProps){
    const [is_ios, set_is_ios] = useState(false)
    const [is_loaded, set_is_loaded] = useState(false)
    const [fallback_blob_url, set_fallback_blob_url] = useState("")

    const requested_src = src ? `${image_proxy_api || ""}${src}` : ""
    const resolved_src = fallback_blob_url || requested_src || undefined

    useEffect(() => {
        set_is_ios(is_ios_device())
    }, [])

    useEffect(() => {
        if (!fallback_blob_url) return

        return () => {
            URL.revokeObjectURL(fallback_blob_url)
        }
    }, [fallback_blob_url])

    useEffect(() => {
        let ignore = false

        if (src){
            set_fallback_blob_url("")
            return
        }

        generate_cover_image(alt || "", {}).then(url => {
            if (ignore){
                URL.revokeObjectURL(url)
                return
            }
            set_fallback_blob_url(url)
        })

        return () => {
            ignore = true
        }
    }, [alt, src])

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
                <div
                    className="w-full h-full relative"
                    onTouchEnd={event => {
                        // Avoid the blue magnified outline shown by mobile WebKit after touch interactions.
                        event.preventDefault()
                    }}
                >
                    <img
                        {...image_props}
                        alt={alt || ""}
                        src={resolved_src}
                        className={`${image_class_name || ""} w-full h-full object-cover [-webkit-touch-callout:none] ${is_ios ? "[-webkit-user-drag:none]" : ""}`}
                        onLoad={event => {
                            set_is_loaded(true)
                            image_props?.onLoad?.(event)
                        }}
                        onError={async event => {
                            image_props?.onError?.(event)
                            if (src && alt && !fallback_blob_url){
                                await generate_cover_image(alt, {}).then(set_fallback_blob_url)
                            }
                            set_is_loaded(true)
                        }}
                        onClick={() => {
                            on_click_image?.()
                        }}
                        onTouchEnd={event => {
                            event.stopPropagation()
                        }}
                    />

                    {label_left != null && <div
                        className={`absolute top-1 left-1 px-2 text-white text-xs font-bold rounded-md ${label_left_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                        onTouchEnd={event => {
                            event.stopPropagation()
                        }}
                    >
                        {label_left}
                    </div>}

                    {label_right != null && <div
                        className={`absolute top-1 right-2 px-2 text-white text-xs font-bold rounded-md ${label_right_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                        onTouchEnd={event => {
                            event.stopPropagation()
                        }}
                    >
                        {label_right}
                    </div>}

                    {top_information != null && <div
                        className={`absolute ${label_left ? "top-6" : "top-1"} left-1 px-1 text-pink-50 text-xs rounded-md ${top_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden max-h-12 max-w-1/2`}
                        onTouchEnd={event => {
                            event.stopPropagation()
                        }}
                    >
                        {top_information}
                    </div>}

                    {bottom_information != null && <div
                        className={`absolute bottom-1 left-1 px-1 text-pink-50 text-xs rounded-md ${bottom_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden  max-h-4 max-w-4/5`}
                        onTouchEnd={event => {
                            event.stopPropagation()
                        }}
                    >
                        {bottom_information}
                    </div>}
                </div>
            </div>
        </ContextMenu>
    )
}

export { LabeledImage }
