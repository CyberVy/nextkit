"use client"

import { useEffect, useState } from "react"
import { string_icons } from "@/infra/ui_constants"
import { generate_cover_image } from "@/infra/data_generation_lib"
import type { LabeledImageInputs } from "@/components/types"
import { is_ios_device, vibrate } from "@/infra/device.client"
import { useInViewport } from "@/components/hooks"

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
    onClickDelete,
    description,
    image_proxy_api,
    clear_margin,
    protected_padding,
    intersection_root_element_ref,
    image_props,
    image_className,
    className,
    ...props
}: LabeledImageInputs) {
    const [is_ios,set_is_ios] = useState(false)
    const [is_loaded,set_is_loaded] = useState(false)
    const [show_description,set_show_description] = useState(false)
    const [fallback_blob_url,set_fallback_blob_url] = useState("")
    const {element_ref: intersection_div_ref, in_view, root_element_ref: _root_element_ref} = useInViewport<HTMLDivElement,HTMLElement>(clear_margin,protected_padding,0)
    const [img_size, set_img_size] = useState([0,0])
    const requested_src = src ? `${image_proxy_api || ""}${src}` : ""
    const resolved_src = fallback_blob_url || requested_src || undefined

    useEffect(() => {
        if (!intersection_root_element_ref) return

        _root_element_ref.current = intersection_root_element_ref.current
    }, [_root_element_ref, intersection_root_element_ref])

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

        generate_cover_image(alt || "",{}).then(url => {
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
        <div
            className={`${in_view ? "intersection-in-view" : "intersection-not-in-view"} ${className || ""}`}
            {...props}
        >
            {clear_margin != undefined &&
                <div
                    ref={intersection_div_ref}
                >
                </div>}

            <div
                className={`w-full h-full relative`}
            >
                {!in_view && <img alt="" style={{visibility:"hidden",width: img_size[0],height:img_size[1]}}/>}
                {in_view &&
                    <>
                        <img
                            {...image_props}
                            alt={alt || ""}
                            src={resolved_src}
                            className={`${image_className || ""} w-full h-full object-cover [-webkit-touch-callout:none] ${is_ios ? "[-webkit-user-drag:none]" : ""}`}
                            onClick={event => {
                                image_props?.onClick?.(event)
                                if (event.defaultPrevented) return
                                vibrate()
                                onClickImage?.()
                            }}
                            onLoad={event => {
                                set_is_loaded(true)
                                set_img_size([event.currentTarget.width,event.currentTarget.height])
                                image_props?.onLoad?.(event)
                            }}
                            onError={async event => {
                                image_props?.onError?.(event)
                                if (src && alt && in_view && !fallback_blob_url){
                                    await generate_cover_image(alt,{}).then(set_fallback_blob_url)
                                }
                                set_is_loaded(true)
                            }}
                        />

                        {label_left && <div
                            className={`absolute top-1 left-1 px-2 text-white text-xs font-bold rounded-md ${label_left_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                        >
                            {label_left}
                        </div>}

                        {label_right && <div
                            className={`absolute top-1 right-2 px-2 text-white text-xs font-bold rounded-md ${label_right_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                        >
                            {label_right}
                        </div>}

                        {top_information && <div
                            className={`absolute ${label_left ? "top-6" : "top-1"} left-1 px-1 text-pink-50 text-xs rounded-md ${top_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden overscroll-none max-h-[48px] max-w-1/2`}
                        >
                            {top_information}
                        </div>}

                        {bottom_information && <div
                            className={`absolute ${onClickDelete ? "bottom-6" : "bottom-1"} left-1 px-1 text-pink-50 text-xs rounded-md ${bottom_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden overscroll-none max-h-[16px] max-w-4/5`}
                        >
                            {bottom_information}
                        </div>}

                        <div>
                            {description &&
                                <button
                                    className={`opacity-70 border hover:cursor-pointer absolute bottom-1 right-1 px-2 text-white text-xs font-bold rounded-md ${is_loaded ? "block" : "hidden"}`}
                                    onClick={() => {
                                        vibrate()
                                        set_show_description(!show_description)
                                    }}
                                    onMouseEnter={() => {
                                        set_show_description(true)
                                    }}
                                    onMouseLeave={() => {
                                        set_show_description(false)
                                    }}
                                >
                                    {string_icons.info}
                                </button>}
                            <div
                                className={`mx-2 bg-black/50 absolute bottom-10 right-2 px-2 py-1 text-white text-sm rounded-lg ${show_description ? "block" : "hidden"}`}
                            >
                                <div className="text-center whitespace-pre-line max-h-[300px] max-w-[50vw] overflow-auto">
                                    {description}
                                </div>
                            </div>
                        </div>

                        {onClickDelete && <button
                            className="absolute bottom-1 left-1 px-2 text-red-400/80 border text-xs rounded-md hover:cursor-pointer"
                            onClick={() => {
                                vibrate()
                                onClickDelete()
                            }}
                        >
                            {string_icons.del}
                        </button>}
                    </>}
            </div>
        </div>
    )
}

export { LabeledImage }
