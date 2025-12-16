"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { string_icons } from "@/infra/custom_ui_constants"
import { generate_cover_image } from "@/infra/data_generation_lib"
import type { LabeledImageInputs } from "@/infra/types"
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
                          intersection_root_element_ref
                      }: LabeledImageInputs) {

    const [requested_src,set_requested_src] = useState(`${image_proxy_api || ""}${src}`)
    const [is_loaded,set_is_loaded] = useState(false)
    const [is_error,set_is_error] = useState(false)
    const [show_description,set_show_description] = useState(false)
    const [generated_cover_image_blob_url, set_generated_cover_image_blob_url] = useState("")
    const {element_ref: intersection_div_ref, in_view, root_element_ref: _root_element_ref} = useInViewport<HTMLDivElement,HTMLElement>(clear_margin,protected_padding,0)
    if (intersection_root_element_ref){
        _root_element_ref.current  = intersection_root_element_ref.current
    }
    const [img_size, set_img_size] = useState([0,0])

    const clear_image_blob_url = useCallback(function clear_image_blob_url() {
        if (generated_cover_image_blob_url_ref.current){
            URL.revokeObjectURL(generated_cover_image_blob_url_ref.current)
        }
        set_generated_cover_image_blob_url("")
    },[])

    const generated_cover_image_blob_url_ref = useRef(generated_cover_image_blob_url)
    useEffect(() => {
        clear_image_blob_url()
        generated_cover_image_blob_url_ref.current = generated_cover_image_blob_url
        set_generated_cover_image_blob_url(generated_cover_image_blob_url)
    }, [generated_cover_image_blob_url])


    useEffect(() => {
        // if an empty src is an input, a cover will be generated and used directly
        if (!src){
            set_is_error(true)
            generate_cover_image(alt || "",{}).then(url => set_generated_cover_image_blob_url(url))
        }
        return () => {
            if (generated_cover_image_blob_url_ref.current){
                URL.revokeObjectURL(generated_cover_image_blob_url_ref.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!src) return

        // if the image is not loaded, or it is loaded with an error,
        // a new requested src will be set to fetch the image
        if (!is_loaded || is_error){
            set_is_error(false)
            clear_image_blob_url()
            set_requested_src(`${image_proxy_api || ""}${src}`)
        }
    }, [image_proxy_api])

    useEffect(() => {
        if (!src) return

        set_is_error(false)
        clear_image_blob_url()
        set_requested_src(`${image_proxy_api || ""}${src}`)
    }, [src])

    // if in_view is false, the img element will be unmounted.
    // sync the state here
    useEffect(() => {
        if (in_view)  return

        set_is_loaded(false)
    }, [in_view])

    return (
        <div className={`${in_view ? "intersection-in-view" : "intersection-not-in-view"}`}>
            {clear_margin != undefined &&
                <div
                    ref={intersection_div_ref}
                >
                </div>
            }

            <main
                className={`w-full h-full relative`}
            >
                {!in_view && <img style={{visibility:"hidden",width: img_size[0],height:img_size[1]}}/>}
                {in_view &&
                    <>
                        <img
                            src={generated_cover_image_blob_url || requested_src || undefined}
                            className={`w-full h-full object-cover rounded-xl [-webkit-touch-callout:none] ${is_ios_device() ? "[-webkit-user-drag:none]" : ""}`}
                            onClick={() => {
                                vibrate()
                                onClickImage?.()
                            }}
                            onLoad={event => {
                                set_is_loaded(true)
                                set_img_size([event.currentTarget.width,event.currentTarget.height])
                            }}
                            onError={async event => {
                                set_is_error(true)
                                if (alt && in_view){
                                    set_generated_cover_image_blob_url(await generate_cover_image(alt, {}))
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
                                </button>
                            }
                            <div
                                className={`mx-2 bg-black/50 absolute bottom-10 right-2 px-2 py-1 text-white text-sm rounded-lg ${show_description ? "block" : "hidden"}`}
                            >
                                <p className="text-center whitespace-pre-line max-h-[300px] max-w-[50vw] overflow-auto">
                                    {description}
                                </p>
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
                    </>
                }
            </main>
        </div>
    )
}

export { LabeledImage }