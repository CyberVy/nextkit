"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { vibrate } from "@/infra/device.client"
import { create_press_gesture } from "@/infra/gestures.client"
import { FullscreenModalContainer } from "@/components/composite/ModalContainer"
import { VerticalMenuBar } from "@/components/base/MenuBar"
import { AnimationContainer } from "@/components/animation/AnimationContainer"
import { BodyPortal } from "@/components/base/Portal"
import type { PointerEvent, ReactNode } from "react"
import type { VerticalMenuBarProps } from "@/components/base/MenuBar"

export type ContextMenuProps = VerticalMenuBarProps & {
    children: ReactNode
    disabled?: boolean
    long_press_ms?: number
    close_after_select?: boolean
    onClickTrigger?: (event: PointerEvent<HTMLDivElement>) => void
}

function get_context_menu_render_point(context_menu_element: HTMLElement, context_menu_point: [number, number]): [number, number]{
    const safe_padding = 12
    const max_x = Math.max(safe_padding, window.innerWidth - context_menu_element.offsetWidth - safe_padding)
    const max_y = Math.max(safe_padding, window.innerHeight - context_menu_element.offsetHeight - safe_padding)
    const next_x = Math.min(Math.max(context_menu_point[0], safe_padding), max_x)
    const next_y = Math.min(Math.max(context_menu_point[1], safe_padding), max_y)

    return [next_x, next_y]
}

function ContextMenu({
    children,
    disabled = false,
    long_press_ms = 300,
    close_after_select = true,
    onClickTrigger,
    className,
    style,
    ref,
    ...menuProps
}: ContextMenuProps){
    const { sections, onSelect, enable_vibration = true, ...remainingMenuProps } = menuProps
    const [show_context_menu, set_show_context_menu] = useState(false)
    const [context_menu_point, set_context_menu_point] = useState<[number, number]>([0, 0])
    const [context_menu_render_point, set_context_menu_render_point] = useState<[number, number]>([0, 0])

    const has_context_menu = Boolean(sections && sections.length > 0)

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
        if (disabled || !has_context_menu) return

        set_context_menu_point([client_x, client_y])
        set_context_menu_render_point([client_x, client_y])
        set_show_context_menu(true)
    }, [disabled, has_context_menu])

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
        return create_press_gesture<PointerEvent<HTMLDivElement>>({
            enabled: event => event.button === 0,
            on_success: () => {
                if (enable_vibration){
                    vibrate()
                }
            },
            click: {
                on_trigger: (event) => {
                    onClickTrigger?.(event)
                },
            },
            long_press: has_context_menu && !disabled ? {
                enabled: event => event.pointerType === "touch",
                on_trigger: event => {
                    open_context_menu(event.clientX, event.clientY)
                },
                ms: long_press_ms,
            } : undefined,
        })
    }, [long_press_ms, has_context_menu, disabled, enable_vibration, onClickTrigger, open_context_menu])

    useEffect(() => {
        return () => {
            press_gesture.reset_press()
        }
    }, [press_gesture])

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

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return

        event.preventDefault()
        event.stopPropagation()
        open_context_menu(event.clientX, event.clientY)
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return
        event.stopPropagation()
        press_gesture.on_pointer_down(event)
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return
        event.stopPropagation()
        press_gesture.on_pointer_move(event)
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return
        event.stopPropagation()
        press_gesture.on_pointer_up(event)
    }

    const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return
        event.stopPropagation()
        press_gesture.on_pointer_cancel(event)
    }

    const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return
        event.stopPropagation()
        press_gesture.on_pointer_leave(event)
    }

    const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
        if (disabled || !has_context_menu) return

        // Avoid the blue magnified outline shown by mobile WebKit after touch interactions.
        event.preventDefault()
    }

    return (
        <>
            <div
                ref={ref}
                className={[
                    className,
                ].filter(Boolean).join(" ")}
                style={style}
                onContextMenu={handleContextMenu}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerLeave}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
            {has_context_menu && !disabled && (
                <BodyPortal>
                    <AnimationContainer
                        duration={300}
                        enter_from={context_menu_enter_from}
                        enter_to={context_menu_enter_to}
                        show={show_context_menu}
                        unmount_on_exit={true}
                        className={"fixed inset-0 z-100 select-none"}
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
                                sections={sections || []}
                                enable_vibration={enable_vibration}
                                onSelect={(key, item) => {
                                    onSelect?.(key, item)
                                    if (close_after_select === false) return

                                    close_context_menu()
                                }}
                                {...remainingMenuProps}
                            />
                        </FullscreenModalContainer>
                    </AnimationContainer>
                </BodyPortal>
            )}
        </>
    )
}

export { ContextMenu }
