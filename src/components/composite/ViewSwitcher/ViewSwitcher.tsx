"use client"

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useId, useMemo } from "react"
import type { ComponentPropsWithRef, ReactNode, TransitionEvent } from "react"
import { create_swipe_gesture } from "@/infra"
import { IOSHapticsContainer } from "@/components/base/IOSHapticContainer"
import { join_classes } from "@/components/utils"
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

/**
 * State machine for view transition animations during touch gestures or automated switches.
 */
type TransitionState<T extends string> =
    | { status: "idle" }
    | {
          /** Active gesture dragging or release animation phase */
          status: "dragging" | "released"
          /** ID of the view from which transition starts */
          active_view_id: T
          /** Index of current active view in views array */
          active_view_index: number
          /** Measured pixel height of current active view container */
          active_view_height: number
          /** Captured window.scrollY of active view prior to gesture start */
          active_view_scroll_y: number
          /** Top offset of active view relative to document top */
          active_view_top: number
          /** Viewport height at gesture initiation time */
          viewport_height: number
          /** Container or viewport width at gesture initiation time */
          viewport_width: number

          /** ID of left neighbor view if available */
          prev_view_id?: T
          /** Cached window.scrollY for prev view */
          prev_view_scroll_y?: number
          /** ID of right neighbor view if available */
          next_view_id?: T
          /** Cached window.scrollY for next view */
          next_view_scroll_y?: number

          /** ID of the target view being swiped into (determined during released phase) */
          target_view_id?: T
          /** Index of target view in views array */
          target_view_index?: number
          /** Cached window.scrollY for target view */
          target_view_scroll_y?: number

          /** Final horizontal offset target during released animation phase */
          target_translation_x?: number
          /** True if swipe distance exceeded threshold confirming view change */
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
 * Check if the document is currently in an iOS rubber-band overscroll phase (top or bottom).
 * Gesture interaction and toolbar click triggers are forbidden during overscroll to avoid visual jumping.
 */
function is_in_overscroll(viewport_height: number): boolean{
    const current_viewport_height = viewport_height || window.innerHeight
    const max_scroll = Math.max(0, document.documentElement.scrollHeight - current_viewport_height)
    return window.scrollY < 0 || window.scrollY > max_scroll
}

/**
 * Evaluates whether the floating toolbar should be hidden based on a boolean or function rule and current scroll position.
 */
function evaluate_toolbar_visibility(rule: boolean | ((scroll_y: number) => boolean) | undefined, scroll_y: number): boolean{
    if (rule === undefined) return true
    return typeof rule === "function" ? !rule(scroll_y) : !rule
}

/**
 * Computes visibility, layout styles, and CSS classes for a given view during transition or idle states.
 *
 * Transiting views are set to `position: fixed; top: 0; left: 0` to pull them out of document flow.
 * Their horizontal positioning (side-by-side) and vertical scroll alignment are fully controlled by `transform: translate3d`.
 */
function compute_view_render_config<T extends string>(
    view: View<T>,
    current_active_view_id: T,
    keep_alive_default: boolean,
    transition_state: TransitionState<T>
){
    const is_active = view.id === current_active_view_id
    const is_keep_alive = view.keep_alive ?? keep_alive_default

    const is_view_active_in_transition = transition_state.status !== "idle" && transition_state.active_view_id === view.id
    const is_view_prev_in_transition = transition_state.status !== "idle" && transition_state.prev_view_id === view.id
    const is_view_next_in_transition = transition_state.status !== "idle" && transition_state.next_view_id === view.id

    const is_transiting = is_view_active_in_transition || is_view_prev_in_transition || is_view_next_in_transition

    const should_render = is_active || is_keep_alive || is_transiting
    if (!should_render) return null

    let style: React.CSSProperties = {}
    let view_class = ""

    if (transition_state.status !== "idle" && is_transiting){
        const container_width = transition_state.viewport_width
        const container_base_height = transition_state.viewport_height - transition_state.active_view_top
        let view_base_x = 0
        let scroll_y = transition_state.active_view_scroll_y

        if (is_view_prev_in_transition){
            view_base_x = -container_width
            scroll_y = transition_state.prev_view_scroll_y ?? 0
        }
        else if (is_view_next_in_transition){
            view_base_x = container_width
            scroll_y = transition_state.next_view_scroll_y ?? 0
        }

        const view_top_offset = transition_state.active_view_top - scroll_y
        const released_target_x = transition_state.status === "released" && transition_state.target_translation_x !== undefined
            ? transition_state.target_translation_x
            : 0

        style = {
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: `${container_base_height + scroll_y}px`,
            overflow: "hidden",
            transform: `translate3d(${view_base_x + released_target_x}px, ${view_top_offset}px, 0)`,
            transition: transition_state.status === "released" ? "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
            zIndex: 10,
            ["--switcher-top-offset" as string]: `${view_top_offset}px`,
            ["--switcher-bottom-offset" as string]: `${view_top_offset}px`,
        } as React.CSSProperties
        view_class = "block"
    }
    else {
        view_class = is_active ? "block w-full min-h-screen" : "hidden"
    }

    return { view_class, style, is_view_active_in_transition }
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
    const fallback_id = useId()
    const switcher_instance_id = id ?? fallback_id

    // State setup: controlled vs uncontrolled active view ID
    const [internal_active_view_id, set_internal_active_view_id] = useState<T>(default_active_view_id ?? views[0]?.id)
    const current_active_view_id = active_view_id !== undefined ? active_view_id : internal_active_view_id

    // Component container Ref callback forwarding
    const container_element_ref = useRef<HTMLDivElement | null>(null)
    const set_container_element_ref = useCallback((element: HTMLDivElement | null) => {
        container_element_ref.current = element
        if (typeof ref === "function") ref(element)
        else if (ref) ref.current = element
    }, [ref])

    // Refs to cache scroll positions and DOM elements per view ID
    const scroll_positions_ref = useRef<Record<string, number>>({})
    const view_elements_ref = useRef<Record<string, HTMLDivElement | null>>({})
    const is_switching_view_ref = useRef<boolean>(false)

    // Gesture transition state machine
    const [transition_state, set_transition_state] = useState<TransitionState<T>>({ status: "idle" })
    const is_transitioning = transition_state.status !== "idle"
    const inner_height_ref = useRef<number>(0)

    // Keep viewport height ref updated on window resize
    useEffect(() => {
        const handle_resize = () => { inner_height_ref.current = window.innerHeight }
        handle_resize()
        window.addEventListener("resize", handle_resize, { passive: true })
        return () => window.removeEventListener("resize", handle_resize)
    }, [])

    // Register with ViewSwitcherController for global toolbar visibility state
    const [is_toolbar_visible, set_is_toolbar_visible] = useState(true)
    const [has_other_transitioning, set_has_other_transitioning] = useState(false)

    useEffect(() => {
        return view_switcher_controller.register(
            switcher_instance_id,
            {
                id: switcher_instance_id,
                is_toolbar_visible: true,
                is_transitioning,
                active_view_id: current_active_view_id,
                target_view_id: transition_state.status !== "idle" ? (transition_state.target_view_id ?? null) : null,
            },
            (updated_state) => {
                set_is_toolbar_visible((prev) => prev === updated_state.is_toolbar_visible ? prev : updated_state.is_toolbar_visible)
                set_has_other_transitioning(view_switcher_controller.has_any_transitioning(switcher_instance_id))
            }
        )
    }, [switcher_instance_id])

    useEffect(() => {
        view_switcher_controller.update_state(switcher_instance_id, {
            is_transitioning,
            active_view_id: current_active_view_id,
            target_view_id: transition_state.status !== "idle" ? (transition_state.target_view_id ?? null) : null,
        })
    }, [switcher_instance_id, transition_state, current_active_view_id, is_transitioning])

    // Derive active view configuration flags
    const active_view_index = views.findIndex((v) => v.id === current_active_view_id)
    const active_view = views[active_view_index]
    const active_view_keep_alive = active_view?.keep_alive ?? keep_alive_default
    const active_view_remember_scroll = active_view_keep_alive && (active_view?.remember_scroll ?? remember_scroll)
    const active_swipe_enabled = active_view?.swipe_enabled
    const should_hide_toolbar = active_view?.should_hide_toolbar

    // Reusable scroll restoration helper locking window.scrollTo
    const restore_scroll_position = useCallback((view_id: T, scroll_y?: number) => {
        const target_scroll_y = scroll_y !== undefined ? scroll_y : (scroll_positions_ref.current[view_id] ?? 0)
        window.scrollTo(0, target_scroll_y)
        scroll_positions_ref.current[view_id] = target_scroll_y
    }, [])

    // Reset transition state machine to idle upon CSS transitionend event
    const handle_transition_end = useCallback((e?: TransitionEvent) => {
        if (e && e.target !== e.currentTarget) return
        if (transition_state.status === "idle") return

        set_transition_state({ status: "idle" })
    }, [transition_state])

    // Stale-closure bypass ref synchronization for event listeners
    const view_switcher_context = useMemo(() => {
        return {
            current_active_view_id, active_view_remember_scroll, active_swipe_enabled,
            active_view_index, views, transition_state, handle_transition_end, is_transitioning
        }
    }, [current_active_view_id, active_view_remember_scroll, active_swipe_enabled, active_view_index, views, transition_state, handle_transition_end, is_transitioning])

    const view_switcher_context_ref = useRef<ViewSwitcherContext<T>>(view_switcher_context)

    useLayoutEffect(() => {
        view_switcher_context_ref.current = view_switcher_context
    }, [view_switcher_context])

    // Window scroll listener: records scroll position and updates toolbar visibility
    useEffect(() => {
        const handle_scroll = () => {
            const { current_active_view_id: active_id, active_view_remember_scroll, views: current_views } = view_switcher_context_ref.current
            if (is_switching_view_ref.current || view_switcher_context_ref.current.is_transitioning) return

            const current_scroll_y = window.scrollY
            if (active_view_remember_scroll){
                scroll_positions_ref.current[active_id] = current_scroll_y
            }

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

    // Restore scroll position synchronously pre-paint on active view change
    useLayoutEffect(() => {
        if (is_transitioning) return

        is_switching_view_ref.current = true

        const target_scroll_y = active_view_remember_scroll ? (scroll_positions_ref.current[current_active_view_id] ?? 0) : 0
        restore_scroll_position(current_active_view_id, target_scroll_y)

        const is_visible = evaluate_toolbar_visibility(should_hide_toolbar, target_scroll_y)
        view_switcher_controller.set_toolbar_visible(switcher_instance_id, is_visible)

        is_switching_view_ref.current = false
    }, [current_active_view_id, active_view_remember_scroll, restore_scroll_position, is_transitioning, should_hide_toolbar, switcher_instance_id])

    // Lock touchmove document scrolling while transition animation is active
    useEffect(() => {
        if (!is_transitioning) return
        const prevent_scroll = (e: TouchEvent) => { if (e.cancelable) e.preventDefault() }
        document.addEventListener("touchmove", prevent_scroll, { passive: false })
        return () => document.removeEventListener("touchmove", prevent_scroll)
    }, [is_transitioning])

    // Bind horizontal swipe gesture handlers
    useEffect(() => {
        const container_element = container_element_ref.current
        if (!container_element) return

        const handle_touch_start = () => {
            inner_height_ref.current = window.innerHeight
        }

        container_element.addEventListener("touchstart", handle_touch_start, { passive: true })

        const swipe_gesture = create_swipe_gesture({
            is_allowed: (swipe_direction) => {
                const { transition_state, handle_transition_end, active_swipe_enabled, active_view_index, views } = view_switcher_context_ref.current

                // Forbid swipe during iOS overscroll/bounce
                if (is_in_overscroll(inner_height_ref.current)) return false

                if (view_switcher_controller.has_any_transitioning(switcher_instance_id)) return false

                if (transition_state.status === "released"){
                    const final_scroll_y = (transition_state.is_switching_confirmed === false
                        ? transition_state.active_view_scroll_y
                        : transition_state.target_view_scroll_y) ?? 0
                    const final_view_id = transition_state.is_switching_confirmed === false
                        ? transition_state.active_view_id
                        : transition_state.target_view_id

                    handle_transition_end()
                    if (final_view_id) restore_scroll_position(final_view_id, final_scroll_y)
                }
                else if (transition_state.status === "dragging"){
                    return false
                }

                if (active_swipe_enabled === false || active_swipe_enabled === "none") return false
                if (active_swipe_enabled === "left" || active_swipe_enabled === "right"){
                    if (active_swipe_enabled !== swipe_direction) return false
                }

                if (swipe_direction === "right" && active_view_index <= 0) return false
                if (swipe_direction === "left" && active_view_index >= views.length - 1) return false

                return true
            },
            on_swipe_start: () => {
                const { current_active_view_id, views, active_view_index } = view_switcher_context_ref.current

                let prev_id: T | undefined
                let prev_scroll_y = 0
                if (active_view_index > 0){
                    prev_id = views[active_view_index - 1].id
                    prev_scroll_y = scroll_positions_ref.current[prev_id] ?? 0
                }

                let next_id: T | undefined
                let next_scroll_y = 0
                if (active_view_index < views.length - 1){
                    next_id = views[active_view_index + 1].id
                    next_scroll_y = scroll_positions_ref.current[next_id] ?? 0
                }

                if (prev_id || next_id){
                    let active_height = 0
                    let active_view_top = 0
                    const active_child = view_elements_ref.current[current_active_view_id]
                    if (active_child){
                        active_height = active_child.offsetHeight
                        active_view_top = active_child.getBoundingClientRect().top + window.scrollY
                    }

                    const container_width = container_element.clientWidth || window.innerWidth

                    set_transition_state({
                        status: "dragging",
                        active_view_id: current_active_view_id,
                        active_view_index,
                        active_view_height: active_height,
                        active_view_scroll_y: window.scrollY,
                        active_view_top,
                        viewport_height: inner_height_ref.current || window.innerHeight,
                        viewport_width: container_width,
                        prev_view_id: prev_id,
                        prev_view_scroll_y: prev_scroll_y,
                        next_view_id: next_id,
                        next_view_scroll_y: next_scroll_y,
                    })
                    return true
                }
                return false
            },
            on_swipe_move: (delta_x) => {
                const current_transition = view_switcher_context_ref.current.transition_state
                if (current_transition.status !== "dragging") return

                const { active_view_top, active_view_scroll_y, prev_view_id, prev_view_scroll_y, next_view_id, next_view_scroll_y, viewport_width } = current_transition
                const { active_swipe_enabled } = view_switcher_context_ref.current

                const is_left_allowed = active_swipe_enabled !== false && active_swipe_enabled !== "none" && active_swipe_enabled !== "right"
                const is_right_allowed = active_swipe_enabled !== false && active_swipe_enabled !== "none" && active_swipe_enabled !== "left"

                let actual_delta_x = delta_x
                if (delta_x < 0 && (!next_view_id || !is_left_allowed)){
                    actual_delta_x = 0
                }
                else if (delta_x > 0 && (!prev_view_id || !is_right_allowed)){
                    actual_delta_x = 0
                }

                // Direct DOM transform updates during drag for high 120fps performance without React re-renders
                const active_el = view_elements_ref.current[current_transition.active_view_id]
                const prev_el = prev_view_id ? view_elements_ref.current[prev_view_id] : null
                const next_el = next_view_id ? view_elements_ref.current[next_view_id] : null

                const active_view_top_offset = active_view_top - active_view_scroll_y
                if (active_el){
                    active_el.style.transform = `translate3d(${actual_delta_x}px, ${active_view_top_offset}px, 0)`
                    active_el.style.setProperty("--switcher-top-offset", `${active_view_top_offset}px`)
                    active_el.style.setProperty("--switcher-bottom-offset", `${active_view_top_offset}px`)
                }
                if (prev_el){
                    const prev_view_top_offset = active_view_top - (prev_view_scroll_y ?? 0)
                    prev_el.style.transform = `translate3d(${-viewport_width + actual_delta_x}px, ${prev_view_top_offset}px, 0)`
                    prev_el.style.setProperty("--switcher-top-offset", `${prev_view_top_offset}px`)
                    prev_el.style.setProperty("--switcher-bottom-offset", `${prev_view_top_offset}px`)
                }
                if (next_el){
                    const next_view_top_offset = active_view_top - (next_view_scroll_y ?? 0)
                    next_el.style.transform = `translate3d(${viewport_width + actual_delta_x}px, ${next_view_top_offset}px, 0)`
                    next_el.style.setProperty("--switcher-top-offset", `${next_view_top_offset}px`)
                    next_el.style.setProperty("--switcher-bottom-offset", `${next_view_top_offset}px`)
                }
            },
            on_swipe_end: (should_complete, target_delta_x) => {
                const current_transition = view_switcher_context_ref.current.transition_state
                if (current_transition.status === "idle") return

                let final_should_complete = should_complete
                const { active_view_index, prev_view_id, next_view_id } = current_transition

                let target_id: T | undefined
                let target_index: number | undefined
                let target_scroll_y: number | undefined

                if (should_complete){
                    if (target_delta_x < 0 && next_view_id){
                        target_id = next_view_id
                        target_index = active_view_index + 1
                        target_scroll_y = current_transition.next_view_scroll_y
                    }
                    else if (target_delta_x > 0 && prev_view_id){
                        target_id = prev_view_id
                        target_index = active_view_index - 1
                        target_scroll_y = current_transition.prev_view_scroll_y
                    }
                    else {
                        final_should_complete = false
                    }
                }

                const actual_target_delta_x = final_should_complete ? target_delta_x : 0

                if (final_should_complete && target_id){
                    if (active_view_id === undefined) set_internal_active_view_id(target_id)
                    on_view_change?.(target_id)
                }
                else {
                    const active_scroll_y = current_transition.active_view_scroll_y
                    if (active_scroll_y !== undefined) window.scrollTo(0, active_scroll_y)
                }

                // Check if current DOM transform is already within 1px of actual_target_delta_x.
                // If so, CSS transition will not fire a transitionend event, so reset to idle immediately.
                const active_el = view_elements_ref.current[current_transition.active_view_id]
                let current_delta_x = 0
                if (active_el && active_el.style.transform){
                    const match = active_el.style.transform.match(/translate3d\(([-0-9.]+)px/)
                    if (match && match[1]){
                        current_delta_x = parseFloat(match[1])
                    }
                }

                const prev_el = prev_view_id ? view_elements_ref.current[prev_view_id] : null
                const next_el = next_view_id ? view_elements_ref.current[next_view_id] : null

                if (Math.abs(current_delta_x - actual_target_delta_x) < 1){
                    if (active_el){
                        active_el.style.transform = ""
                        active_el.style.removeProperty("--switcher-top-offset")
                        active_el.style.removeProperty("--switcher-bottom-offset")
                    }
                    if (prev_el){
                        prev_el.style.transform = ""
                        prev_el.style.removeProperty("--switcher-top-offset")
                        prev_el.style.removeProperty("--switcher-bottom-offset")
                    }
                    if (next_el){
                        next_el.style.transform = ""
                        next_el.style.removeProperty("--switcher-top-offset")
                        next_el.style.removeProperty("--switcher-bottom-offset")
                    }

                    if (final_should_complete && target_id && target_scroll_y !== undefined){
                        restore_scroll_position(target_id, target_scroll_y)
                    }

                    set_transition_state({ status: "idle" })
                    return
                }

                const active_view_top_offset = current_transition.active_view_top - current_transition.active_view_scroll_y
                const release_transition_css = "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)"

                if (active_el){
                    active_el.style.transition = release_transition_css
                    active_el.style.transform = `translate3d(${actual_target_delta_x}px, ${active_view_top_offset}px, 0)`
                    active_el.style.setProperty("--switcher-top-offset", `${active_view_top_offset}px`)
                    active_el.style.setProperty("--switcher-bottom-offset", `${active_view_top_offset}px`)
                }
                if (prev_el){
                    const prev_view_top_offset = current_transition.active_view_top - (current_transition.prev_view_scroll_y ?? 0)
                    prev_el.style.transition = release_transition_css
                    prev_el.style.transform = `translate3d(${-current_transition.viewport_width + actual_target_delta_x}px, ${prev_view_top_offset}px, 0)`
                    prev_el.style.setProperty("--switcher-top-offset", `${prev_view_top_offset}px`)
                    prev_el.style.setProperty("--switcher-bottom-offset", `${prev_view_top_offset}px`)
                }
                if (next_el){
                    const next_view_top_offset = current_transition.active_view_top - (current_transition.next_view_scroll_y ?? 0)
                    next_el.style.transition = release_transition_css
                    next_el.style.transform = `translate3d(${current_transition.viewport_width + actual_target_delta_x}px, ${next_view_top_offset}px, 0)`
                    next_el.style.setProperty("--switcher-top-offset", `${next_view_top_offset}px`)
                    next_el.style.setProperty("--switcher-bottom-offset", `${next_view_top_offset}px`)
                }

                set_transition_state((prev) => prev.status === "idle" ? prev : {
                    ...prev,
                    status: "released",
                    target_view_id: target_id,
                    target_view_index: target_index,
                    target_view_scroll_y: target_scroll_y,
                    target_translation_x: actual_target_delta_x,
                    is_switching_confirmed: final_should_complete,
                })
            },
        })

        const unbind_gesture = swipe_gesture.bind(container_element)
        return () => {
            container_element.removeEventListener("touchstart", handle_touch_start)
            unbind_gesture()
        }
    }, [])

    // Toolbar navigation button click handler
    const handle_toolbar_click = (view_id: T) => {
        if (is_transitioning || view_id === current_active_view_id) return
        if (is_in_overscroll(inner_height_ref.current)) return
        if (view_switcher_controller.has_any_transitioning(switcher_instance_id)) return

        if (active_view_id === undefined) set_internal_active_view_id(view_id)
        on_view_change?.(view_id)
    }

    return (
        <div ref={set_container_element_ref} className={join_classes("w-full h-full", className)} {...props}>
            {/* Content Views Area */}
            <div className="w-full h-full">
                {views.map((view) => {
                    const render_config = compute_view_render_config(view, current_active_view_id, keep_alive_default, transition_state)
                    if (!render_config) return null

                    return (
                        <div
                            key={view.id}
                            ref={(el) => {
                                if (el) view_elements_ref.current[view.id] = el
                                else delete view_elements_ref.current[view.id]
                            }}
                            className={render_config.view_class}
                            style={render_config.style}
                            onTransitionEnd={render_config.is_view_active_in_transition ? handle_transition_end : undefined}
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
                                (transition_state.prev_view_scroll_y ?? 0) + transition_state.viewport_height,
                                (transition_state.next_view_scroll_y ?? 0) + transition_state.viewport_height
                            ),
                        }}
                    />
                )}
            </div>

            {/* Floating Bottom/Top ToolBar */}
            <div
                className={join_classes(
                    toolbar_layout === "top-floating"
                        ? styles["viewswitcher-toolbar-top"]
                        : styles["viewswitcher-toolbar-bottom"],
                    "fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5",
                    "bg-white/40 dark:bg-black/40 backdrop-blur-md",
                    "p-1 rounded-full",
                    "border border-black/10 dark:border-white/10 shadow-lg",
                    styles["viewswitcher-toolbar"],
                    !is_toolbar_visible && styles["toolbar-hidden"],
                    toolbar_className
                )}
            >
                <div className="rounded-full border border-black/10 dark:border-white/10 p-1">
                    <div className="inline-flex flex-row items-center p-1 bg-background/0! backdrop-blur-none!">
                        {views.map((view) => {
                            const is_active = view.id === current_active_view_id
                            return (
                                <button
                                    key={view.id}
                                    type="button"
                                    className="focus-visible:outline-none disabled:pointer-events-none"
                                    disabled={is_transitioning || is_active || has_other_transitioning}
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
                                                            ? view.icon
                                                                ? "text-red-700 dark:text-red-500"
                                                                : "text-black dark:text-white"
                                                            : "text-black/50 dark:text-white/50"
                                                    )}
                                                >
                                                    {view.icon}
                                                    {view.label && (
                                                        <span
                                                            className={join_classes(
                                                                view.icon
                                                                    ? "text-[9px] mt-0.5 font-medium"
                                                                    : "text-[10px] sm:text-xs font-semibold",
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

                {toolbar_extra_actions && (
                    <>
                        <div className="w-px h-6 bg-black/15 dark:bg-white/15" />
                        <div className="flex items-center justify-center">{toolbar_extra_actions}</div>
                    </>
                )}
            </div>
        </div>
    )
}
