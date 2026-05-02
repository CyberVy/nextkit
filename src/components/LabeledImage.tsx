"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { string_icons } from "@/infra/ui_constants"
import { generate_cover_image } from "@/infra/data_generation_lib"
import type { LabeledImageProps } from "@/components/types"
import { is_ios_device, vibrate } from "@/infra/device.client"
import { create_press_gesture } from "@/infra/gestures.client"
import { useInViewport } from "@/components/hooks"
import { FullscreenModalContainer } from "@/components/ModalContainer"
import { VerticalMenuBar } from "@/components/VerticalMenuBar"
import { AnimationContainer } from "@/components/animation/AnimationContainer"

function get_context_menu_render_point(context_menu_element: HTMLElement, context_menu_point: [number, number]): [number, number]{
    const safe_padding = 12
    const max_x = Math.max(safe_padding, window.innerWidth - context_menu_element.offsetWidth - safe_padding)
    const max_y = Math.max(safe_padding, window.innerHeight - context_menu_element.offsetHeight - safe_padding)
    const next_x = Math.min(Math.max(context_menu_point[0], safe_padding), max_x)
    const next_y = Math.min(Math.max(context_menu_point[1], safe_padding), max_y)

    return [next_x, next_y]
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
    onClickDelete,
    description,
    image_proxy_api,
    clear_margin,
    protected_padding,
    intersection_root_element,
    context_menu,
    image_props,
    image_className,
    className,
    ...props
}: LabeledImageProps){
    const [is_ios, set_is_ios] = useState(false)
    const [is_loaded, set_is_loaded] = useState(false)
    const [show_description, set_show_description] = useState(false)
    const [fallback_blob_url, set_fallback_blob_url] = useState("")
    const [show_context_menu, set_show_context_menu] = useState(false)
    const [context_menu_point, set_context_menu_point] = useState<[number, number]>([0, 0])
    const [context_menu_render_point, set_context_menu_render_point] = useState<[number, number]>([0, 0])
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
    const has_context_menu = Boolean(context_menu?.sections.length)

    const context_menu_enter_from = useMemo(() => {
        return { transform: "scale(0.0)" }
    }, [])

    const context_menu_enter_to = useMemo(() => {
        return { transform: "scale(1.0)" }
    }, [])

    const close_context_menu = useCallback(() => {
        set_show_context_menu(false)
    }, [])

    const open_context_menu = useCallback((client_x: number, client_y: number) => {
        if (!has_context_menu) return

        set_context_menu_point([client_x, client_y])
        set_context_menu_render_point([client_x, client_y])
        set_show_context_menu(true)
    }, [has_context_menu])

    const set_context_menu_element = useCallback((context_menu_element: HTMLElement | null) => {
        if (!context_menu_element) return

        const next_context_menu_render_point = get_context_menu_render_point(context_menu_element, context_menu_point)
        set_context_menu_render_point(current_context_menu_render_point => {
            if (
                current_context_menu_render_point[0] === next_context_menu_render_point[0]
                && current_context_menu_render_point[1] === next_context_menu_render_point[1]
            ){
                return current_context_menu_render_point
            }

            return next_context_menu_render_point
        })
    }, [context_menu_point])

    const press_gesture = useMemo(() => {
        return create_press_gesture<ReactPointerEvent<HTMLImageElement>>({
            enabled: event => event.button === 0,
            on_success: () => {
                vibrate()
            },
            click: {
                on_trigger: () => {
                    onClickImage?.()
                },
            },
            long_press: has_context_menu ? {
                enabled: event => event.pointerType === "touch",
                on_trigger: event => {
                    open_context_menu(event.clientX, event.clientY)
                },
                ms: context_menu?.long_press_ms ?? 300,
            } : undefined,
        })
    }, [context_menu?.long_press_ms, has_context_menu, onClickImage, open_context_menu])

    useEffect(() => {
        return () => {
            press_gesture.reset_press()
        }
    }, [press_gesture])

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

    useEffect(() => {
        if (!show_context_menu) return

        const close_on_escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return

            close_context_menu()
        }

        window.addEventListener("keydown", close_on_escape)

        return () => {
            window.removeEventListener("keydown", close_on_escape)
        }
    }, [close_context_menu, show_context_menu])

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

                            onContextMenu={event => {
                                if (!has_context_menu) return

                                event.preventDefault()
                                open_context_menu(event.clientX, event.clientY)
                            }}
                            onPointerDown={event => {
                                press_gesture.on_pointer_down(event)
                            }}
                            onPointerMove={event => {
                                press_gesture.on_pointer_move(event)
                            }}
                            onPointerUp={event => {
                                press_gesture.on_pointer_up(event)
                            }}
                            onPointerCancel={event => {
                                press_gesture.on_pointer_cancel(event)
                            }}
                            onPointerLeave={event => {
                                press_gesture.on_pointer_leave(event)
                            }}
                        />

                        {label_left && <div
                            className={`absolute top-1 left-1 px-2 text-white text-xs font-bold rounded-md ${label_left_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                            onTouchEnd={event => {
                                event.stopPropagation()
                            }}
                        >
                            {label_left}
                        </div>}

                        {label_right && <div
                            className={`absolute top-1 right-2 px-2 text-white text-xs font-bold rounded-md ${label_right_background_color || ""} ${is_loaded ? "block" : "hidden"}`}
                            onTouchEnd={event => {
                                event.stopPropagation()
                            }}
                        >
                            {label_right}
                        </div>}

                        {top_information && <div
                            className={`absolute ${label_left ? "top-6" : "top-1"} left-1 px-1 text-pink-50 text-xs rounded-md ${top_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden max-h-12 max-w-1/2`}
                            onTouchEnd={event => {
                                event.stopPropagation()
                            }}
                        >
                            {top_information}
                        </div>}

                        {bottom_information && <div
                            className={`absolute ${onClickDelete ? "bottom-6" : "bottom-1"} left-1 px-1 text-pink-50 text-xs rounded-md ${bottom_information_background_color || ""} ${is_loaded ? "block" : "hidden"} overflow-hidden  max-h-4 max-w-4/5`}
                            onTouchEnd={event => {
                                event.stopPropagation()
                            }}
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
                                    onTouchEnd={event => {
                                        event.stopPropagation()
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
                            onTouchEnd={event => {
                                event.stopPropagation()
                            }}
                        >
                            {string_icons.del}
                        </button>}
                    </>}
            </div>
            {has_context_menu &&
                <AnimationContainer
                    duration={300}
                    enter_from={context_menu_enter_from}
                    enter_to={context_menu_enter_to}
                    show={show_context_menu}
                    unmount_on_exit={true}
                    className={"fixed inset-0 z-40"}
                    style={{
                        transformOrigin: `${context_menu_point[0]}px ${context_menu_point[1]}px`
                    }}
                >
                    <FullscreenModalContainer
                        onContextMenu={event => {
                            event.preventDefault()
                        }}
                        onClick={() => {
                            close_context_menu()
                        }}
                        onTouchEnd={event => {
                            // Avoid the blue magnified outline shown by mobile WebKit after touch interactions.
                            event.preventDefault()
                            event.currentTarget.click()
                        }}
                    >

                        <VerticalMenuBar
                            className={"fixed w-[min(320px,calc(100vw-24px))]"}
                            style={{
                                left: context_menu_render_point[0],
                                top: context_menu_render_point[1],
                            }}
                            onContextMenu={event => {
                                event.preventDefault()
                                event.stopPropagation()
                            }}
                            onClick={event => {
                                event.stopPropagation()
                            }}
                            onTouchEnd={event => {
                                event.stopPropagation()
                            }}
                            ref={set_context_menu_element}
                            sections={context_menu?.sections || []}
                            header={context_menu?.header}
                            footer={context_menu?.footer}
                            compact={context_menu?.compact}
                            accent_color={context_menu?.accent_color}
                            enable_vibration={context_menu?.enable_vibration}
                            onSelect={(key, item) => {
                                context_menu?.onSelect?.(key, item)
                                if (context_menu?.close_after_select === false) return

                                close_context_menu()
                            }}
                        />

                    </FullscreenModalContainer>
                </AnimationContainer>}
        </div>
    )
}

export { LabeledImage }
