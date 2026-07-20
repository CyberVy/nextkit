"use client"

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import type { ComponentPropsWithRef, ReactNode, TransitionEvent } from "react"
import { is_ios_device, vibrate } from "@/infra/device.client"
import { create_swipe_gesture } from "@/infra"
import { IOSHapticsContainer } from "@/components/base/IOSHapticContainer"
import { join_classes, is_element_hidden } from "@/components/utils"
import { view_switcher_controller } from "./ViewSwitcherController"
import styles from "./ViewSwitcher.module.css"

export interface View<T extends string = string> {
    /** Unique identifier for the view */
    id: T
    /** React node for the icon displayed in the navigation bar (optional) */
    icon?: ReactNode
    /** Label text or node displayed below the icon (optional) */
    label?: ReactNode
    /** Component or content to render when this view is selected */
    content: ReactNode
    /** Override global keep-alive setting for this specific view */
    keep_alive?: boolean
    /** Override global scroll memory setting for this specific view. Only effective when keep_alive resolves to true. */
    remember_scroll?: boolean
    /** Whether horizontal swipe transition is enabled for this view. Defaults to true. */
    swipe_enabled?: boolean | "left" | "right" | "both" | "none"
}

export type ViewSwitcherProps<T extends string = string> = Omit<ComponentPropsWithRef<"div">, "children" | "onChange"> & {
    /** Unique identifier for registering with the view switcher controller */
    id?: string
    /** List of view configurations */
    views: View<T>[]
    /** The active view ID for controlled mode */
    active_view_id?: T
    /** Initial active view ID for uncontrolled mode */
    default_active_view_id?: T
    /** Callback triggered when active view changes */
    on_view_change?: (view_id: T) => void
    /** Default keep-alive value if a view doesn't specify keep_alive */
    keep_alive_default?: boolean
    /** Whether to automatically remember and restore scroll positions of keep-alive views */
    remember_scroll?: boolean
    /** Extra actions/buttons to display on the right side of the floating toolbar */
    toolbar_extra_actions?: ReactNode
    /** Custom class for the floating bottom bar */
    toolbar_className?: string
    /** Custom class for individual view buttons */
    toolbar_item_className?: string
    /** Layout positioning: bottom floating (default) or top floating */
    toolbar_layout?: 'bottom-floating' | 'top-floating'
}

interface TransitionState<T extends string> {
    active_id: T
    target_id: T
    active_index: number
    target_index: number
    delta_x: number
    is_animating: boolean
    active_height: number
    active_scroll_y: number
    target_scroll_y: number
    active_view_top: number
}

/**
 * ARCHITECTURAL DESIGN NOTE: Window Scroll vs. Container Scroll on iOS Safari
 *
 * We use global Window Scroll instead of container scroll (`overflow-y: auto` on views)
 * because container scroll on iOS Safari behaves unpredictably:
 * 1. It causes nested scroll chaining (momentum overscroll conflicts between body and container).
 * 2. Fixed elements (like bottom toolbars) fail to anchor correctly relative to Safe Areas because
 *    iOS requires document-level scrolling to dynamically fold/unfold browser bars.
 *
 * How we animate horizontal swipe transitions with Window Scroll:
 * 1. Transitioning views are set to `position: "fixed"` to pull them out of the document flow
 *    so they can be placed side-by-side (`left: 0` vs `left: 100% / -100%`).
 * 2. Since `fixed` elements stay static relative to the viewport, we manually offset their `top`
 *    by subtracting the active/target scroll positions to align them vertically.
 * 3. A height spacer placeholder is rendered at the bottom of the container to prevent the document height
 *    from collapsing to 0 during transition (which would reset `window.scrollY` to 0).
 */
export function ViewSwitcher<T extends string = string>({
    id,
    views,
    active_view_id,
    default_active_view_id,
    on_view_change,
    keep_alive_default = false,
    remember_scroll = true,
    toolbar_extra_actions,
    className,
    toolbar_className,
    toolbar_item_className,
    toolbar_layout = "bottom-floating",
    ref,
    ...props
}: ViewSwitcherProps<T>){
    // Uncontrolled state fallback
    const [internal_active_id, set_internal_active_id] = useState<T>(
        default_active_view_id ?? views[0]?.id
    )

    const current_active_id = active_view_id !== undefined ? active_view_id : internal_active_id

    const container_ref = useRef<HTMLDivElement | null>(null)
    const set_container_ref = useCallback((element: HTMLDivElement | null) => {
        container_ref.current = element

        if (typeof ref === "function"){
            ref(element)
        }
        else if (ref){
            ref.current = element
        }
    }, [ref])

    // Ref to store scroll positions of keep_alive views
    const scroll_positions = useRef<Record<string, number>>({})
    const view_doms_ref = useRef<Record<string, HTMLDivElement | null>>({})

    const [transition_state, set_transition_state] = useState<TransitionState<T> | null>(null)
 
    const is_transition_active = useRef<boolean>(false)
    const is_switching_view = useRef<boolean>(false)
    const is_swipe_cancelled = useRef<boolean>(false)

    // Refs to cache scroll layout dimensions during active gesture to avoid layout thrashing
    const scroll_height_ref = useRef<number>(0)
    const inner_height_ref = useRef<number>(0)

    const [controlled_toolbar_visible, set_controlled_toolbar_visible] = useState(true)

    useEffect(() => {
        if (!id) return

        const unsubscribe = view_switcher_controller.register(
            id,
            {
                id,
                is_toolbar_visible: true,
                is_transitioning: transition_state !== null,
                active_view_id: current_active_id,
                target_view_id: transition_state?.target_id ?? null,
                delta_x: transition_state?.delta_x ?? 0,
            },
            (updated_state) => {
                set_controlled_toolbar_visible(prev => {
                    if (prev === updated_state.is_toolbar_visible) return prev
                    return updated_state.is_toolbar_visible
                })
            }
        )

        return unsubscribe
    }, [id])

    useEffect(() => {
        if (!id) return

        view_switcher_controller.update_state(id, {
            is_transitioning: transition_state !== null,
            active_view_id: current_active_id,
            target_view_id: transition_state?.target_id ?? null,
            delta_x: transition_state?.delta_x ?? 0,
        })
    }, [id, transition_state, current_active_id])

    // Reusable scroll restoration helper that locks scroll tracking to prevent layout-shift corruption
    const restore_scroll_position = useCallback((view_id: T, scroll_y?: number) => {
        const target_scroll_y = scroll_y !== undefined ? scroll_y : (scroll_positions.current[view_id] ?? 0)
        is_switching_view.current = true
        window.scrollTo(0, target_scroll_y)
        scroll_positions.current[view_id] = target_scroll_y
        requestAnimationFrame(() => {
            is_switching_view.current = false
        })
    }, [])

    // Find the currently active view configuration and indices
    const active_view_index = views.findIndex((v) => v.id === current_active_id)
    const active_view = active_view_index !== -1 ? views[active_view_index] : undefined
    const active_view_keep_alive = active_view?.keep_alive ?? keep_alive_default
    const active_view_remember_scroll = active_view_keep_alive && (active_view?.remember_scroll ?? remember_scroll)
    const active_swipe_enabled = active_view?.swipe_enabled

    const pending_scroll_restore = useRef<{ view_id: T; scroll_y: number } | null>(null)

    const handle_transition_end = (e?: TransitionEvent) => {
        if (e && e.target !== e.currentTarget) return
        
        const restore_scroll_y = transition_state?.active_scroll_y
        const target_scroll_y = transition_state?.target_scroll_y
        const target_id = transition_state?.target_id
        
        if (is_swipe_cancelled.current && restore_scroll_y !== undefined){
            pending_scroll_restore.current = { view_id: current_active_id, scroll_y: restore_scroll_y }
        }
        else if (!is_swipe_cancelled.current && target_scroll_y !== undefined && target_id){
            pending_scroll_restore.current = { view_id: target_id, scroll_y: target_scroll_y }
        }
        
        set_transition_state(null)
        is_transition_active.current = false
        is_swipe_cancelled.current = false
    }

    const state_ref = useRef<{
        current_active_id: T
        active_view_remember_scroll: boolean
        active_swipe_enabled: View<T>["swipe_enabled"]
        active_view_index: number
        views: View<T>[]
        transition_state: TransitionState<T> | null
        handle_transition_end: (e?: TransitionEvent) => void
            }>({
                current_active_id,
                active_view_remember_scroll,
                active_swipe_enabled,
                active_view_index,
                views,
                transition_state,
                handle_transition_end
            })

    useLayoutEffect(() => {
        state_ref.current = {
            current_active_id,
            active_view_remember_scroll,
            active_swipe_enabled,
            active_view_index,
            views,
            transition_state,
            handle_transition_end
        }
    })

    // Listen to scroll events and save position
    useEffect(() => {
        const handle_scroll = () => {
            const { current_active_id: active_id, active_view_remember_scroll } = state_ref.current

            if (!active_view_remember_scroll) return
            if (is_switching_view.current){
                return
            }
 
            // If the switcher container itself or any ancestor is hidden (display: none), do not record scroll
            if (is_element_hidden(container_ref.current)){
                return
            }
            if (is_transition_active.current){
                return
            }
            scroll_positions.current[active_id] = window.scrollY
        }

        window.addEventListener("scroll", handle_scroll, { passive: true })
        return () => window.removeEventListener("scroll", handle_scroll)
    }, [])

    // Restore scroll position when active view changes
    useLayoutEffect(() => {
        if (is_transition_active.current) return

        if (pending_scroll_restore.current){
            const { view_id, scroll_y } = pending_scroll_restore.current
            pending_scroll_restore.current = null
            restore_scroll_position(view_id, scroll_y)
        }
        else {
            if (active_view_remember_scroll){
                restore_scroll_position(current_active_id)
            }
            else{
                restore_scroll_position(current_active_id, 0)
            }
        }
    }, [current_active_id, active_view_remember_scroll, restore_scroll_position, transition_state === null])
 
    // Clear active transition state on window resize (e.g. Stage Manager resizing)
    useEffect(() => {
        const handle_resize = () => {
            // Ignore resize events during active swipe transitions or swipe animations
            // since layout switches (e.g., setting elements to fixed, updating spacers)
            // can trigger container resize events on mobile browsers and cause premature resets.
            if (is_transition_active.current){
                return
            }
            set_transition_state(null)
            is_transition_active.current = false
        }
 
        window.addEventListener("resize", handle_resize)
        return () => window.removeEventListener("resize", handle_resize)
    }, [])

    // Prevent vertical scrolling/jumping by locking document scrolling during transition
    const is_transitioning = transition_state !== null
    useEffect(() => {
        if (!is_transitioning) return

        const prevent_scroll = (e: TouchEvent) => {
            if (e.cancelable){
                e.preventDefault()
            }
        }

        document.addEventListener("touchmove", prevent_scroll, { passive: false })

        return () => {
            document.removeEventListener("touchmove", prevent_scroll)
        }
    }, [is_transitioning])

    // Handle gesture interaction and scroll locking
    useEffect(() => {
        const el = container_ref.current
        if (!el) return

        const handle_touch_start = () => {
            // Cache layout dimensions on touchstart before any touchmove occurs to avoid layout thrashing
            scroll_height_ref.current = document.documentElement.scrollHeight
            inner_height_ref.current = window.innerHeight
        }

        el.addEventListener("touchstart", handle_touch_start, { passive: true })

        const swipe_gesture = create_swipe_gesture({
            is_allowed: (swipe_direction) => {
                const { transition_state, handle_transition_end, active_swipe_enabled } = state_ref.current

                // Forbid swipe gestures during overscroll/bounce phase (top or bottom) using cached layout dimensions
                const max_scroll = Math.max(0, scroll_height_ref.current - inner_height_ref.current)
                if (window.scrollY < 0 || window.scrollY > max_scroll){
                    return false
                }

                // If currently transitioning, allow snapping the active animation on touch start
                if (transition_state !== null){
                    if (transition_state.is_animating){
                        handle_transition_end()
                    }
                    return false
                }

                // Check if horizontal swipe direction is allowed for this view
                if (active_swipe_enabled === false || active_swipe_enabled === "none"){
                    return false
                }
                if (active_swipe_enabled === "left" || active_swipe_enabled === "right"){
                    return active_swipe_enabled === swipe_direction
                }
                return true
            },
            on_swipe_start: (swipe_direction) => {
                const { current_active_id, views, active_view_index } = state_ref.current
                let target_id: T | null = null
                let target_index = -1

                if (swipe_direction === "left" && active_view_index < views.length - 1){
                    target_index = active_view_index + 1
                    target_id = views[target_index].id
                }
                else if (swipe_direction === "right" && active_view_index > 0){
                    target_index = active_view_index - 1
                    target_id = views[target_index].id
                }

                if (target_id){
                    is_transition_active.current = true

                    // Measure current active view height and top offset relative to document
                    let active_height = 0
                    let active_view_top = 0
                    const active_child = view_doms_ref.current[current_active_id]
                    if (active_child){
                        active_height = active_child.offsetHeight
                        active_view_top = active_child.getBoundingClientRect().top + window.scrollY
                    }

                    set_transition_state({
                        active_id: current_active_id,
                        target_id: target_id,
                        active_index: active_view_index,
                        target_index,
                        delta_x: 0,
                        is_animating: false,
                        active_height,
                        active_scroll_y: window.scrollY,
                        target_scroll_y: scroll_positions.current[target_id] ?? 0,
                        active_view_top
                    })
                    return true
                }
                return false
            },
            on_swipe_move: (diff_x) => {
                set_transition_state((prev) => {
                    if (!prev){
                        return null
                    }

                    const { active_index } = prev
                    const { views, active_swipe_enabled } = state_ref.current

                    const is_left_allowed = active_swipe_enabled !== false && active_swipe_enabled !== "none" && active_swipe_enabled !== "right"
                    const is_right_allowed = active_swipe_enabled !== false && active_swipe_enabled !== "none" && active_swipe_enabled !== "left"

                    let target_index = prev.target_index
                    let target_id = prev.target_id
                    let target_scroll_y = prev.target_scroll_y
                    let delta_x = diff_x

                    if (diff_x < 0){
                        // Dragging left (attempting to show next view)
                        const has_next = active_index < views.length - 1
                        if (has_next && is_left_allowed){
                            const next_index = active_index + 1
                            const next_id = views[next_index].id
                            if (next_id !== target_id){
                                target_index = next_index
                                target_id = next_id
                                target_scroll_y = scroll_positions.current[next_id] ?? 0
                            }
                        }
                        else {
                            delta_x = 0
                        }
                    }
                    else if (diff_x > 0){
                        // Dragging right (attempting to show prev view)
                        const has_prev = active_index > 0
                        if (has_prev && is_right_allowed){
                            const prev_index = active_index - 1
                            const prev_id = views[prev_index].id
                            if (prev_id !== target_id){
                                target_index = prev_index
                                target_id = prev_id
                                target_scroll_y = scroll_positions.current[prev_id] ?? 0
                            }
                        }
                        else {
                            delta_x = 0
                        }
                    }

                    return {
                        ...prev,
                        delta_x,
                        target_index,
                        target_id,
                        target_scroll_y
                    }
                })
            },
            on_swipe_end: (should_complete, target_delta) => {
                const transition = state_ref.current.transition_state
                let final_should_complete = should_complete

                if (transition && should_complete){
                    const { active_index, target_index } = transition
                    if (target_index > active_index && target_delta >= 0){
                        final_should_complete = false
                    }
                    else if (target_index < active_index && target_delta <= 0){
                        final_should_complete = false
                    }
                }

                const actual_target_delta = final_should_complete ? target_delta : 0

                if (final_should_complete){
                    const target_id = transition?.target_id
                    if (target_id){
                        if (active_view_id === undefined){
                            set_internal_active_id(target_id)
                        }
                        on_view_change?.(target_id)
                    }
                }
                else {
                    const active_scroll_y = transition?.active_scroll_y
                    if (active_scroll_y !== undefined){
                        window.scrollTo(0, active_scroll_y)
                    }
                    // Mark explicitly that the swipe transition has been cancelled by the user
                    is_swipe_cancelled.current = true
                }

                set_transition_state((prev) => {
                    if (!prev){
                        return null
                    }
                    // If the transition distance is less than 1px, clear transition state immediately
                    // since transitionend won't fire for static or negligible property changes.
                    if (Math.abs(prev.delta_x - actual_target_delta) < 1){
                        is_transition_active.current = false
                        restore_scroll_position(
                            final_should_complete ? prev.target_id : current_active_id,
                            final_should_complete ? prev.target_scroll_y : prev.active_scroll_y
                        )
                        return null
                    }
                    return {
                        ...prev,
                        delta_x: actual_target_delta,
                        is_animating: true,
                        should_complete: final_should_complete
                    }
                })
            }
        })

        const unbind_gesture = swipe_gesture.bind(el)

        return () => {
            el.removeEventListener("touchstart", handle_touch_start)
            unbind_gesture()
        }
    }, [])

    const handle_toolbar_click = (view_id: T) => {
        // Forbid switching views during transitions
        if (transition_state !== null){
            return
        }
        // Forbid switching to the already active view
        if (view_id === current_active_id){
            return
        }
        // Forbid switching views during bounce/overscroll phase (top or bottom)
        const max_scroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        if (window.scrollY < 0 || window.scrollY > max_scroll){
            return
        }
        if (!is_ios_device()){
            vibrate()
        }
        if (active_view_id === undefined){
            set_internal_active_id(view_id)
        }
        on_view_change?.(view_id)
    }

    return (
        <div ref={set_container_ref} className={join_classes("w-full h-full", className)} {...props}>
            {/* Content Views Area */}
            <div className="w-full h-full">
                {views.map((view, index) => {
                    const is_active = view.id === current_active_id
                    const should_keep = view.keep_alive ?? keep_alive_default

                    const is_trans_active = transition_state?.active_id === view.id
                    const is_trans_target = transition_state?.target_id === view.id

                    const should_render = is_active || should_keep || is_trans_active || is_trans_target
                    if (!should_render) return null

                    let style: React.CSSProperties = {}
                    let className = ""

                    if (transition_state && (is_trans_active || is_trans_target)){
                        const base_height = window.innerHeight - transition_state.active_view_top
                        const scroll_y = is_trans_active ? transition_state.active_scroll_y : transition_state.target_scroll_y
                        
                        let left_val = "0"
                        if (is_trans_target){
                            left_val = transition_state.target_index > transition_state.active_index ? "100%" : "-100%"
                        }

                        // Align both transitioning views to the active_scroll_y vertically,
                        // and shift the target view vertically by the difference in scroll positions.
                        const y_offset = is_trans_target ? (transition_state.active_scroll_y - transition_state.target_scroll_y) : 0

                        style = {
                            position: "fixed",
                            top: transition_state.active_view_top - transition_state.active_scroll_y,
                            left: left_val,
                            width: "100%",
                            height: `${base_height + scroll_y}px`,
                            overflow: "hidden",
                            transform: `translate3d(${transition_state.delta_x}px, ${y_offset}px, 0)`,
                            transition: transition_state.is_animating ? "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                            zIndex: 10,
                            "--switcher-top-offset": `${transition_state.active_view_top - scroll_y}px`,
                        } as React.CSSProperties
                        className = "block"
                    }
                    else{
                        className = is_active ? "block w-full min-h-screen" : "hidden"
                    }

                    return (
                        <div
                            key={view.id}
                            ref={(el) => {
                                if (el){
                                    view_doms_ref.current[view.id] = el
                                }
                                else{
                                    delete view_doms_ref.current[view.id]
                                }
                            }}
                            className={className}
                            style={style}
                            onTransitionEnd={is_trans_active ? handle_transition_end : undefined}
                        >
                            {view.content}
                        </div>
                    )
                })}
                {/* Spacer to prevent document height collapse and window.scrollY reset during fixed transition */}
                {transition_state && (
                    <div
                        className="w-full min-h-screen"
                        style={{
                            height: Math.max(
                                transition_state.active_height,
                                transition_state.target_scroll_y + window.innerHeight
                            )
                        }}
                    />
                )}
            </div>

            {/* Floating Bottom/Top ToolBar */}
            <div
                className={join_classes(
                    toolbar_layout === "top-floating"
                        ? styles["viewswitcher-toolbar-top"]
                        : `bottom-3 ${styles["viewswitcher-toolbar-bottom"]}`,
                    "fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5",
                    "bg-white/40 dark:bg-black/40 backdrop-blur-md",
                    "p-1 rounded-full",
                    "border border-black/10 dark:border-white/10 shadow-lg",
                    styles["viewswitcher-toolbar"],
                    !controlled_toolbar_visible && styles["toolbar-hidden"],
                    toolbar_className
                )}
            >
                {/* Navigation Section */}
                <div className="rounded-full border border-black/10 dark:border-white/10 p-1">
                    <div className="inline-flex flex-row items-center p-1 bg-background/0! backdrop-blur-none!">
                        {views.map((view) => {
                            const is_active = view.id === current_active_id
                            return (
                                <button
                                    key={view.id}
                                    type="button"
                                    className="focus-visible:outline-none disabled:pointer-events-none"
                                    disabled={transition_state !== null || is_active}
                                    onClick={() => handle_toolbar_click(view.id)}
                                >
                                    <IOSHapticsContainer>
                                        <span
                                            className={join_classes(
                                                "relative align-middle inline-block px-4 overflow-hidden rounded-[18px]",
                                                "transition duration-300 ease-in-out hover:cursor-pointer",
                                                toolbar_item_className ?? "w-16 h-10"
                                            )}
                                        >
                                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
                                                <span
                                                    className={join_classes(
                                                        "flex flex-col items-center justify-center transition-all",
                                                        is_active
                                                            ? (view.icon ? "text-red-700 dark:text-red-500" : "text-black dark:text-white")
                                                            : "text-black/50 dark:text-white/50"
                                                    )}
                                                >
                                                    {view.icon}
                                                    {view.label && (
                                                        <span
                                                            className={join_classes(
                                                                view.icon ? "text-[9px] mt-0.5 font-medium" : "text-[10px] sm:text-xs font-semibold",
                                                                is_active && !view.icon ? "font-bold" : ""
                                                            )}
                                                        >
                                                            {view.label}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </span>
                                    </IOSHapticsContainer>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Optional Custom Actions (Settings, etc.) */}
                {toolbar_extra_actions && (
                    <>
                        {/* Vertical Divider */}
                        <div className="w-px h-6 bg-black/15 dark:bg-white/15" />
                        <div className="flex items-center justify-center">
                            {toolbar_extra_actions}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
