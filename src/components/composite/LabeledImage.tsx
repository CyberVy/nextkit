"use client"

import { useEffect, useState } from "react"
import { generate_cover_image } from "@/infra/data_generation_lib"

import { is_ios_device } from "@/infra/device.client"
import { useInViewport } from "@/components/hooks"
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
    image_className?: string
    label_left?: ReactNode
    label_left_background_color?: string
    label_right?: ReactNode
    label_right_background_color?: string
    alt?: string
    onClickImage?: () => void
    clear_margin?: number
    protected_padding?: number
    intersection_root_element?: HTMLElement | null
    context_menu?: Omit<ContextMenuProps, "children" | "disabled" | "onClickTrigger">
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
    onClickImage,
    image_proxy_api,
    clear_margin,
    protected_padding,
    intersection_root_element,
    context_menu,
    image_props,
    image_className,
    className,
    ref,
    ...props
}: LabeledImageProps){
    const [is_ios, set_is_ios] = useState(false)
    const [is_loaded, set_is_loaded] = useState(false)
    const [fallback_blob_url, set_fallback_blob_url] = useState("")

    const { ref: intersection_div_ref, in_view } = useInViewport<HTMLDivElement>({
        enabled: clear_margin != undefined,
        root: intersection_root_element,
        root_margin: clear_margin ?? 0,
        protected_padding: protected_padding ?? 0,
        initial_in_view: clear_margin == undefined,
    })
    const [img_size, set_img_size] = useState([0, 0])
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

    useEffect(() => {
        if (in_view) return

        set_is_loaded(false)
    }, [in_view])

    return (
        <ContextMenu
            sections={context_menu?.sections || []}
            {...context_menu}
            className={className}
            ref={ref}
        >
            <div
                className={`${in_view ? "intersection-in-view" : "intersection-not-in-view"} select-none w-full h-full`}
                {...props}
            >
                {clear_margin != null &&
                    <div
                        ref={intersection_div_ref}
                    >
                    </div>}

                <div
                    className={`w-full h-full relative`}
                    onTouchEnd={event => {
                        // Avoid the blue magnified outline shown by mobile WebKit after touch interactions.
                        event.preventDefault()
                    }}
                >
                    {!in_view && <img alt="" style={{ visibility: "hidden", width: img_size[0], height: img_size[1] }}/>}
                    {in_view &&
                        <>
                            <img
                                {...image_props}
                                alt={alt || ""}
                                src={resolved_src}
                                className={`${image_className || ""} w-full h-full object-cover [-webkit-touch-callout:none] ${is_ios ? "[-webkit-user-drag:none]" : ""}`}
                                onLoad={event => {
                                    set_is_loaded(true)
                                    set_img_size([event.currentTarget.width, event.currentTarget.height])
                                    image_props?.onLoad?.(event)
                                }}
                                onError={async event => {
                                    image_props?.onError?.(event)
                                    if (src && alt && in_view && !fallback_blob_url){
                                        await generate_cover_image(alt, {}).then(set_fallback_blob_url)
                                    }
                                    set_is_loaded(true)
                                }}
                                onClick={() => {
                                    onClickImage?.()
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
                        </>}
                </div>
            </div>
        </ContextMenu>
    )
}

export { LabeledImage }
