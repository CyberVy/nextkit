"use client"

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useId } from "react"
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
    /** Control whether to hide the floating toolbar based on scroll position */
    should_hide_toolbar?: boolean | ((scroll_y: number) => boolean)
}

function evaluate_toolbar_visibility(rule: boolean | ((scroll_y: number) => boolean) | undefined, scroll_y: number): boolean{
    if (rule === undefined){
        return true
    }
    if (typeof rule === "function"){
        return !rule(scroll_y)
    }
    return !rule
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

type TransitionState<T extends string> =
    | { status: "idle" }
    | {
          status: "dragging" | "released"
          /** ID of the currently active view from which transition starts */
          active_view_id: T
          /** ID of the target view that the user is transitioning to */
          target_view_id: T
          /** Index of the active view in the views configuration list */
          active_view_index: number
          /** Index of the target view in the views configuration list */
          target_view_index: number
          /** Current horizontal swipe offset in pixels */
          translation_x: number
          /** Measured height in pixels of the active view container */
          active_view_height: number
          /** Saved scroll position Y of the active view before transition started */
          active_view_scroll_y: number
          /** Saved scroll position Y of the target view before transition started */
          target_view_scroll_y: number
          /** Vertical offset of the active view container relative to document top */
          active_view_top: number
          /** True if the swipe has exceeded threshold and is confirmed to switch views */
          is_switching_confirmed?: boolean
      }

/**
 * Context wrapper passed into stale-closure bypass refs (e.g., gesture listeners and scroll event handlers)
 * to access the latest reactive states without triggering duplicate listener bindings.
 */
interface ViewSwitcherContext<T extends string> {
    current_active_view_id: T
    active_view_remember_scroll: boolean
    active_swipe_enabled: View<T>["swipe_enabled"]
    active_view_index: number
    views: View<T>[]
    transition_state: TransitionState<T>
    handle_transition_end: (e?: TransitionEvent) => void
    is_transitioning: boolean
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
    const fallback_switcher_id = useId()
    const switcher_instance_id = id ?? fallback_switcher_id

    // Uncontrolled state fallback
    const [internal_active_view_id, set_internal_active_view_id] = useState<T>(
        default_active_view_id ?? views[0]?.id
    )

    const current_active_view_id = active_view_id !== undefined ? active_view_id : internal_active_view_id

    const container_element_ref = useRef<HTMLDivElement | null>(null)
    const set_container_element_ref = useCallback((element: HTMLDivElement | null) => {
        container_element_ref.current = element

        if (typeof ref === "function"){
            ref(element)
        }
        else if (ref){
            ref.current = element
        }
    }, [ref])

    // Ref to store scroll positions of keep_alive views
    const scroll_positions_ref = useRef<Record<string, number>>({})
    const view_elements_ref = useRef<Record<string, HTMLDivElement | null>>({})

    const is_switching_view_ref = useRef<boolean>(false)

    const [transition_state, set_transition_state] = useState<TransitionState<T>>({ status: "idle" })
    const is_transitioning = transition_state.status !== "idle"
 
    // Refs to cache scroll layout dimensions during active gesture to avoid layout thrashing
    const scroll_height_ref = useRef<number>(0)
    const inner_height_ref = useRef<number>(0)

    const [is_toolbar_visible, set_is_toolbar_visible] = useState(true)

    useEffect(() => {
        const unsubscribe = view_switcher_controller.register(
            switcher_instance_id,
            {
                id: switcher_instance_id,
                is_toolbar_visible: true,
                is_transitioning,
                active_view_id: current_active_view_id,
                target_view_id: transition_state.status !== "idle" ? transition_state.target_view_id : null,
                translation_x: transition_state.status !== "idle" ? transition_state.translation_x : 0,
            },
            (updated_state) => {
                set_is_toolbar_visible(prev => {
                    if (prev === updated_state.is_toolbar_visible) return prev
                    return updated_state.is_toolbar_visible
                })
            }
        )

        return unsubscribe
    }, [switcher_instance_id])

    useEffect(() => {
        view_switcher_controller.update_state(switcher_instance_id, {
            is_transitioning,
            active_view_id: current_active_view_id,
            target_view_id: transition_state.status !== "idle" ? transition_state.target_view_id : null,
            translation_x: transition_state.status !== "idle" ? transition_state.translation_x : 0,
        })
    }, [switcher_instance_id, transition_state, current_active_view_id])

    // Reusable scroll restoration helper that locks scroll tracking to prevent layout-shift corruption
    const restore_scroll_position = useCallback((view_id: T, scroll_y?: number) => {
        const target_scroll_y = scroll_y !== undefined ? scroll_y : (scroll_positions_ref.current[view_id] ?? 0)
        window.scrollTo(0, target_scroll_y)
        scroll_positions_ref.current[view_id] = target_scroll_y
    }, [])

    // Find the currently active view configuration and indices
    const active_view_index = views.findIndex((v) => v.id === current_active_view_id)
    const active_view = active_view_index !== -1 ? views[active_view_index] : undefined
    const active_view_keep_alive = active_view?.keep_alive ?? keep_alive_default
    const active_view_remember_scroll = active_view_keep_alive && (active_view?.remember_scroll ?? remember_scroll)
    const active_swipe_enabled = active_view?.swipe_enabled

    const pending_scroll_restore_ref = useRef<{ view_id: T; scroll_y: number } | null>(null)

    const handle_transition_end = (e?: TransitionEvent) => {
        if (e && e.target !== e.currentTarget) return
        if (transition_state.status === "idle") return
        
        const restore_scroll_y = transition_state.active_view_scroll_y
        const target_scroll_y = transition_state.target_view_scroll_y
        const target_id = transition_state.target_view_id
        const is_cancelled = transition_state.is_switching_confirmed === false

        if (is_cancelled && restore_scroll_y !== undefined){
            pending_scroll_restore_ref.current = { view_id: current_active_view_id, scroll_y: restore_scroll_y }
        }
        else if (!is_cancelled && target_scroll_y !== undefined && target_id){
            pending_scroll_restore_ref.current = { view_id: target_id, scroll_y: target_scroll_y }
        }
        
        set_transition_state({ status: "idle" })
    }

    const state_ref = useRef<ViewSwitcherContext<T>>({
        current_active_view_id,
        active_view_remember_scroll,
        active_swipe_enabled,
        active_view_index,
        views,
        transition_state,
        handle_transition_end,
        is_transitioning
    })

    useLayoutEffect(() => {
        state_ref.current = {
            current_active_view_id,
            active_view_remember_scroll,
            active_swipe_enabled,
            active_view_index,
            views,
            transition_state,
            handle_transition_end,
            is_transitioning
        }
    })

    // Listen to scroll events to:
    // 1. Record scroll position of keep-alive views
    // 2. Hide/show toolbar based on should_hide_toolbar config
    useEffect(() => {
        const handle_scroll = () => {
            const {
                current_active_view_id: active_id,
                active_view_remember_scroll,
                views: current_views
            } = state_ref.current

            if (is_switching_view_ref.current || state_ref.current.is_transitioning) return
            if (is_element_hidden(container_element_ref.current)) return

            const current_scroll_y = window.scrollY

            // 1. Record scroll position
            if (active_view_remember_scroll){
                scroll_positions_ref.current[active_id] = current_scroll_y
            }

            // 2. Control toolbar visibility
            const active_view_config = current_views.find((v) => v.id === active_id)
            const rule = active_view_config?.should_hide_toolbar
            if (rule !== undefined){
                const is_visible = evaluate_toolbar_visibility(rule, current_scroll_y)
                view_switcher_controller.set_toolbar_visible(switcher_instance_id, is_visible)
            }
        }

        window.addEventListener("scroll", handle_scroll, { passive: true })
        return () => window.removeEventListener("scroll", handle_scroll)
    }, [switcher_instance_id])

    const active_view_config = views.find((v) => v.id === current_active_view_id)
    const should_hide_toolbar = active_view_config?.should_hide_toolbar

    // Restore scroll position and sync toolbar visibility when active view changes (runs synchronously before paint)
    useLayoutEffect(() => {
        if (is_transitioning) return

        is_switching_view_ref.current = true

        let target_scroll_y = 0
        if (pending_scroll_restore_ref.current){
            const { view_id, scroll_y } = pending_scroll_restore_ref.current
            pending_scroll_restore_ref.current = null
            restore_scroll_position(view_id, scroll_y)
            target_scroll_y = scroll_y
        }
        else {
            if (active_view_remember_scroll){
                restore_scroll_position(current_active_view_id)
                target_scroll_y = scroll_positions_ref.current[current_active_view_id] ?? 0
            }
            else{
                restore_scroll_position(current_active_view_id, 0)
                target_scroll_y = 0
            }
        }

        // Sync toolbar visibility state based on target scroll position on view change or config change
        if (should_hide_toolbar !== undefined){
            const is_visible = evaluate_toolbar_visibility(should_hide_toolbar, target_scroll_y)
            view_switcher_controller.set_toolbar_visible(switcher_instance_id, is_visible)
        }
        else{
            view_switcher_controller.set_toolbar_visible(switcher_instance_id, true)
        }
    }, [
        current_active_view_id,
        active_view_remember_scroll,
        restore_scroll_position,
        is_transitioning,
        should_hide_toolbar,
        switcher_instance_id
    ])

    // Release scroll lock after the browser has completed layout and painted the screen.
    // This must be run asynchronously inside useEffect (post-paint) because scrollTo scroll events
    // are dispatched asynchronously by the browser. If we release the lock synchronously,
    // the incoming scroll event would pollute the target view's scroll cache with the old viewport height.
    useEffect(() => {
        is_switching_view_ref.current = false
    }, [
        current_active_view_id,
        active_view_remember_scroll,
        restore_scroll_position,
        is_transitioning,
        should_hide_toolbar,
        switcher_instance_id
    ])
 
    // Prevent vertical scrolling/jumping by locking document scrolling during transition
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
        const container_element = container_element_ref.current
        if (!container_element) return

        const handle_touch_start = () => {
            // Cache layout dimensions on touchstart before any touchmove occurs to avoid layout thrashing
            scroll_height_ref.current = document.documentElement.scrollHeight
            inner_height_ref.current = window.innerHeight
        }

        container_element.addEventListener("touchstart", handle_touch_start, { passive: true })

        const swipe_gesture = create_swipe_gesture({
            is_allowed: (swipe_direction) => {
                const { transition_state, handle_transition_end, active_swipe_enabled } = state_ref.current

                // Forbid swipe gestures during overscroll/bounce phase (top or bottom) using cached layout dimensions
                const max_scroll = Math.max(0, scroll_height_ref.current - inner_height_ref.current)
                if (window.scrollY < 0 || window.scrollY > max_scroll){
                    return false
                }

                // If currently transitioning, snap the active animation on touch start so new gesture can proceed seamlessly
                if (transition_state.status === "released"){
                    const target_scroll_y = transition_state.target_view_scroll_y
                    const target_id = transition_state.target_view_id
                    const is_cancelled = transition_state.is_switching_confirmed === false
                    const final_scroll_y = (is_cancelled ? transition_state.active_view_scroll_y : target_scroll_y) ?? 0
                    const final_view_id = is_cancelled ? transition_state.active_view_id : target_id

                    handle_transition_end()

                    if (final_view_id){
                        restore_scroll_position(final_view_id, final_scroll_y)
                    }
                }
                else if (transition_state.status === "dragging"){
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
                const { current_active_view_id, views, active_view_index } = state_ref.current
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
                    // Measure current active view height and top offset relative to document
                    let active_height = 0
                    let active_view_top = 0
                    const active_child = view_elements_ref.current[current_active_view_id]
                    if (active_child){
                        active_height = active_child.offsetHeight
                        active_view_top = active_child.getBoundingClientRect().top + window.scrollY
                    }

                    set_transition_state({
                        status: "dragging",
                        active_view_id: current_active_view_id,
                        target_view_id: target_id,
                        active_view_index: active_view_index,
                        target_view_index: target_index,
                        translation_x: 0,
                        active_view_height: active_height,
                        active_view_scroll_y: window.scrollY,
                        target_view_scroll_y: scroll_positions_ref.current[target_id] ?? 0,
                        active_view_top
                    })
                    return true
                }
                return false
            },
            on_swipe_move: (delta_x) => {
                const current_transition = state_ref.current.transition_state
                if (current_transition.status !== "dragging") return

                const { active_view_index, active_view_scroll_y } = current_transition
                const { views, active_swipe_enabled } = state_ref.current

                const is_left_allowed = active_swipe_enabled !== false && active_swipe_enabled !== "none" && active_swipe_enabled !== "right"
                const is_right_allowed = active_swipe_enabled !== false && active_swipe_enabled !== "none" && active_swipe_enabled !== "left"

                let target_index = current_transition.target_view_index
                let target_id = current_transition.target_view_id
                let target_scroll_y = current_transition.target_view_scroll_y
                let actual_delta_x = delta_x

                if (delta_x < 0){
                    // Dragging left (attempting to show next view)
                    const has_next = active_view_index < views.length - 1
                    if (has_next && is_left_allowed){
                        const next_index = active_view_index + 1
                        const next_id = views[next_index].id
                        if (next_id !== target_id){
                            target_index = next_index
                            target_id = next_id
                            target_scroll_y = scroll_positions_ref.current[next_id] ?? 0
                        }
                    }
                    else {
                        actual_delta_x = 0
                    }
                }
                else if (delta_x > 0){
                    // Dragging right (attempting to show prev view)
                    const has_prev = active_view_index > 0
                    if (has_prev && is_right_allowed){
                        const prev_index = active_view_index - 1
                        const prev_id = views[prev_index].id
                        if (prev_id !== target_id){
                            target_index = prev_index
                            target_id = prev_id
                            target_scroll_y = scroll_positions_ref.current[prev_id] ?? 0
                        }
                    }
                    else {
                        actual_delta_x = 0
                    }
                }

                // If target view changed (direction reversed), update React state to switch target view
                if (target_id !== current_transition.target_view_id){
                    set_transition_state((prev) => {
                        if (prev.status !== "dragging") return prev
                        return {
                            ...prev,
                            translation_x: actual_delta_x,
                            target_view_index: target_index,
                            target_view_id: target_id,
                            target_view_scroll_y: target_scroll_y
                        }
                    })
                    return
                }

                // Direct DOM transform update during drag without triggering React re-renders
                const active_el = view_elements_ref.current[current_transition.active_view_id]
                const target_el = view_elements_ref.current[target_id]
                if (active_el){
                    active_el.style.transform = `translate3d(${actual_delta_x}px, 0px, 0)`
                }
                if (target_el){
                    const vertical_offset = active_view_scroll_y - target_scroll_y
                    target_el.style.transform = `translate3d(${actual_delta_x}px, ${vertical_offset}px, 0)`
                }
            },
            on_swipe_end: (should_complete, target_delta_x) => {
                const current_transition = state_ref.current.transition_state
                let final_should_complete = should_complete

                if (current_transition.status !== "idle" && should_complete){
                    const { active_view_index, target_view_index } = current_transition
                    if (target_view_index > active_view_index && target_delta_x >= 0){
                        final_should_complete = false
                    }
                    else if (target_view_index < active_view_index && target_delta_x <= 0){
                        final_should_complete = false
                    }
                }

                const actual_target_delta_x = final_should_complete ? target_delta_x : 0

                if (final_should_complete){
                    const target_id = current_transition.status !== "idle" ? current_transition.target_view_id : undefined
                    if (target_id){
                        if (active_view_id === undefined){
                            set_internal_active_view_id(target_id)
                        }
                        on_view_change?.(target_id)
                    }
                }
                else {
                    const active_scroll_y = current_transition.status !== "idle" ? current_transition.active_view_scroll_y : undefined
                    if (active_scroll_y !== undefined){
                        window.scrollTo(0, active_scroll_y)
                    }
                }

                set_transition_state((prev) => {
                    if (prev.status === "idle"){
                        return prev
                    }
                    // If the transition distance is less than 1px, clear transition state immediately
                    // since transitionend won't fire for static or negligible property changes.
                    if (Math.abs(prev.translation_x - actual_target_delta_x) < 1){
                        restore_scroll_position(
                            final_should_complete ? prev.target_view_id : current_active_view_id,
                            final_should_complete ? prev.target_view_scroll_y : prev.active_view_scroll_y
                        )
                        return { status: "idle" }
                    }
                    return {
                        ...prev,
                        translation_x: actual_target_delta_x,
                        status: "released",
                        is_switching_confirmed: final_should_complete
                    }
                })
            }
        })

        const unbind_gesture = swipe_gesture.bind(container_element)

        return () => {
            container_element.removeEventListener("touchstart", handle_touch_start)
            unbind_gesture()
        }
    }, [])

    const handle_toolbar_click = (view_id: T) => {
        // Forbid switching views during transitions
        if (is_transitioning){
            return
        }
        // Forbid switching to the already active view
        if (view_id === current_active_view_id){
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
            set_internal_active_view_id(view_id)
        }
        on_view_change?.(view_id)
    }

    return (
        <div ref={set_container_element_ref} className={join_classes("w-full h-full", className)} {...props}>
            {/* Content Views Area */}
            <div className="w-full h-full">
                {views.map((view, index) => {
                    const is_active = view.id === current_active_view_id
                    const is_keep_alive = view.keep_alive ?? keep_alive_default

                    const is_view_active_in_transition = transition_state.status !== "idle" && transition_state.active_view_id === view.id
                    const is_view_target_in_transition = transition_state.status !== "idle" && transition_state.target_view_id === view.id

                    const should_render = is_active || is_keep_alive || is_view_active_in_transition || is_view_target_in_transition
                    if (!should_render) return null

                    let style: React.CSSProperties = {}
                    let view_class = ""

                    if (transition_state.status !== "idle" && (is_view_active_in_transition || is_view_target_in_transition)){
                        const base_height = window.innerHeight - transition_state.active_view_top
                        const scroll_y = is_view_active_in_transition ? transition_state.active_view_scroll_y : transition_state.target_view_scroll_y
                        
                        let left_offset = "0"
                        if (is_view_target_in_transition){
                            left_offset = transition_state.target_view_index > transition_state.active_view_index ? "100%" : "-100%"
                        }

                        // Align both transitioning views to the active_scroll_y vertically,
                        // and shift the target view vertically by the difference in scroll positions.
                        const vertical_offset = is_view_target_in_transition ? (transition_state.active_view_scroll_y - transition_state.target_view_scroll_y) : 0

                        style = {
                            position: "fixed",
                            top: transition_state.active_view_top - transition_state.active_view_scroll_y,
                            left: left_offset,
                            width: "100%",
                            height: `${base_height + scroll_y}px`,
                            overflow: "hidden",
                            transform: `translate3d(${transition_state.translation_x}px, ${vertical_offset}px, 0)`,
                            transition: transition_state.status === "released" ? "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                            zIndex: 10,
                            "--switcher-top-offset": `${transition_state.active_view_top - scroll_y}px`,
                        } as React.CSSProperties
                        view_class = "block"
                    }
                    else{
                        view_class = is_active ? "block w-full min-h-screen" : "hidden"
                    }

                    return (
                        <div
                            key={view.id}
                            ref={(el) => {
                                if (el){
                                    view_elements_ref.current[view.id] = el
                                }
                                else{
                                    delete view_elements_ref.current[view.id]
                                }
                            }}
                            className={view_class}
                            style={style}
                            onTransitionEnd={is_view_active_in_transition ? handle_transition_end : undefined}
                        >
                            {view.content}
                        </div>
                    )
                })}
                {/* Spacer to prevent document height collapse and window.scrollY reset during fixed transition */}
                {transition_state.status !== "idle" && (
                    <div
                        className="w-full min-h-screen"
                        style={{
                            height: Math.max(
                                transition_state.active_view_height,
                                transition_state.target_view_scroll_y + window.innerHeight
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
                    !is_toolbar_visible && styles["toolbar-hidden"],
                    toolbar_className
                )}
            >
                {/* Navigation Section */}
                <div className="rounded-full border border-black/10 dark:border-white/10 p-1">
                    <div className="inline-flex flex-row items-center p-1 bg-background/0! backdrop-blur-none!">
                        {views.map((view) => {
                            const is_active = view.id === current_active_view_id
                            return (
                                <button
                                    key={view.id}
                                    type="button"
                                    className="focus-visible:outline-none disabled:pointer-events-none"
                                    disabled={is_transitioning || is_active}
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
