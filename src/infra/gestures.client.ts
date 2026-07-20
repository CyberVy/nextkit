export type PressCancelReason = "move" | "leave" | "cancel"

type GestureEnabled<TEvent> = boolean | ((event: TEvent) => boolean)

type PressGestureActionParams<TEvent extends { clientX: number, clientY: number }> = {
    on_trigger: (event: TEvent) => void
    enabled?: GestureEnabled<TEvent>
}

type LongPressParams<TEvent extends { clientX: number, clientY: number }> = PressGestureActionParams<TEvent> & {
    on_end?: (event: TEvent) => void
    ms?: number
}

type PressGestureParams<TEvent extends { clientX: number, clientY: number }> = {
    click?: PressGestureActionParams<TEvent>
    on_cancel?: (reason: PressCancelReason, event: TEvent) => void
    on_success?: (event: TEvent) => void
    enabled?: GestureEnabled<TEvent>
    long_press?: LongPressParams<TEvent>
    move_threshold?: number
    stop_propagation?: boolean | ((event: TEvent) => boolean)
    prevent_default?: boolean | ((event: TEvent) => boolean)
}

const is_gesture_enabled = <TEvent, >(enabled: GestureEnabled<TEvent> | undefined, event: TEvent) => {
    if (typeof enabled === "function"){
        return enabled(event)
    }

    return enabled ?? true
}

export function create_press_gesture<TEvent extends { clientX: number, clientY: number, stopPropagation?: () => void, preventDefault?: () => void }>({
    click,
    on_cancel,
    on_success,
    enabled,
    long_press,
    move_threshold = 10,
    stop_propagation = false,
    prevent_default = false,
}: PressGestureParams<TEvent>){
    let timer = 0
    let start_event: TEvent | null = null
    let start_client_x = 0
    let start_client_y = 0
    let should_long_press = false
    let long_pressing = false

    const clear_timer = () => {
        if (!timer) return

        window.clearTimeout(timer)
        timer = 0
    }

    const reset_press = () => {
        clear_timer()
        start_event = null
        start_client_x = 0
        start_client_y = 0
        should_long_press = false
        long_pressing = false
    }

    const cancel_press = (reason: PressCancelReason, event: TEvent) => {
        if (!start_event) return

        reset_press()
        on_cancel?.(reason, event)
    }

    const handle_event_options = (event: TEvent) => {
        const should_stop = typeof stop_propagation === "function" ? stop_propagation(event) : stop_propagation
        if (should_stop && typeof event.stopPropagation === "function"){
            event.stopPropagation()
        }
        const should_prevent = typeof prevent_default === "function" ? prevent_default(event) : prevent_default
        if (should_prevent && typeof event.preventDefault === "function"){
            event.preventDefault()
        }
    }

    const on_pointer_down = (event: TEvent) => {
        if (!is_gesture_enabled(enabled, event)){
            reset_press()
            return
        }

        reset_press()
        handle_event_options(event)
        
        start_event = event
        start_client_x = event.clientX
        start_client_y = event.clientY
        should_long_press = Boolean(long_press?.on_trigger) && is_gesture_enabled(long_press?.enabled, event)

        if (!should_long_press) return

        timer = window.setTimeout(() => {
            if (!start_event) return

            long_pressing = true
            long_press?.on_trigger(start_event)
        }, long_press?.ms ?? 300)
    }

    const on_pointer_move = (event: TEvent) => {
        if (!start_event) return

        if (is_gesture_enabled(enabled, event)){
            handle_event_options(event)
        }

        if (long_pressing) return

        const moved_x = event.clientX - start_client_x
        const moved_y = event.clientY - start_client_y

        if (Math.hypot(moved_x, moved_y) < move_threshold) return

        cancel_press("move", event)
    }

    const on_pointer_up = (event: TEvent) => {
        if (!start_event) return

        if (is_gesture_enabled(enabled, event)){
            handle_event_options(event)
        }

        const did_long_press = long_pressing

        if (did_long_press){
            long_press?.on_end?.(event)
        }

        reset_press()
        if (did_long_press){
            on_success?.(event)
            return
        }

        if (!click?.on_trigger) return
        if (!is_gesture_enabled(click.enabled, event)) return

        click.on_trigger(event)
        on_success?.(event)
    }

    const on_pointer_cancel = (event: TEvent) => {
        if (!start_event) return

        if (is_gesture_enabled(enabled, event)){
            handle_event_options(event)
        }

        if (long_pressing){
            long_press?.on_end?.(event)
            reset_press()
            return
        }

        cancel_press("cancel", event)
    }

    const on_pointer_leave = (event: TEvent) => {
        if (!start_event) return

        if (is_gesture_enabled(enabled, event)){
            handle_event_options(event)
        }

        if (long_pressing){
            long_press?.on_end?.(event)
            reset_press()
            return
        }

        cancel_press("leave", event)
    }

    return {
        on_pointer_down,
        on_pointer_move,
        on_pointer_up,
        on_pointer_cancel,
        on_pointer_leave,
        reset_press,
    }
}

export interface SwipeGestureParams {
    is_allowed: (direction: "left" | "right") => boolean
    on_swipe_start: (direction: "left" | "right") => boolean
    on_swipe_move: (diff_x: number) => void
    on_swipe_end: (should_complete: boolean, target_delta: number) => void
}

export function create_swipe_gesture({
    is_allowed,
    on_swipe_start,
    on_swipe_move,
    on_swipe_end,
}: SwipeGestureParams){
    let bound_element: HTMLElement | null = null
    let touch_start_ref: { x: number; y: number } | null = null
    let is_swiping = false
    let has_scrolled_vertically = false
    let active_touch_target: HTMLElement | null = null

    function remove_target_listeners(){
        if (active_touch_target){
            active_touch_target.removeEventListener("touchmove", on_touch_move)
            active_touch_target.removeEventListener("touchend", on_touch_end)
            active_touch_target.removeEventListener("touchcancel", on_touch_cancel)
            active_touch_target = null
        }
    }

    function on_touch_start(e: TouchEvent){
        if (e.touches.length !== 1){
            return
        }

        const touch = e.touches[0]
        if (!touch || !e.target){
            return
        }

        remove_target_listeners()

        active_touch_target = e.target as HTMLElement
        touch_start_ref = {
            x: touch.clientX,
            y: touch.clientY
        }
        is_swiping = false
        has_scrolled_vertically = false

        active_touch_target.addEventListener("touchmove", on_touch_move, { passive: false })
        active_touch_target.addEventListener("touchend", on_touch_end, { passive: true })
        active_touch_target.addEventListener("touchcancel", on_touch_cancel, { passive: true })
    }

    function on_touch_move(e: TouchEvent){
        if (!touch_start_ref){
            return
        }

        const touch = e.touches[0]
        if (!touch){
            return
        }

        const diff_x = touch.clientX - touch_start_ref.x
        const diff_y = touch.clientY - touch_start_ref.y

        if (!is_swiping){
            if (!has_scrolled_vertically && Math.abs(diff_y) > 10 && Math.abs(diff_y) > Math.abs(diff_x)){
                has_scrolled_vertically = true
            }

            if (!has_scrolled_vertically && Math.abs(diff_x) > Math.abs(diff_y) && Math.abs(diff_x) > 10){
                const direction = diff_x < 0 ? "left" : "right"
                if (is_allowed(direction)){
                    const started = on_swipe_start(direction)
                    if (started){
                        touch_start_ref = {
                            x: touch.clientX,
                            y: touch.clientY
                        }
                        is_swiping = true
                        if (e.cancelable){
                            e.preventDefault()
                        }
                    }
                }
            }
        }
        else{
            if (e.cancelable){
                e.preventDefault()
            }
            on_swipe_move(diff_x)
        }
    }

    function on_touch_end(e: TouchEvent){
        remove_target_listeners()

        if (!is_swiping || !touch_start_ref){
            touch_start_ref = null
            is_swiping = false
            return
        }

        const last_touch = e.changedTouches[0]
        const diff_x = last_touch ? (last_touch.clientX - touch_start_ref.x) : 0
        const width = bound_element?.getBoundingClientRect().width || window.innerWidth
        const threshold = width * 0.2

        const should_complete = Math.abs(diff_x) > threshold
        const target_delta = should_complete
            ? (diff_x > 0 ? width : -width)
            : 0

        on_swipe_end(should_complete, target_delta)

        touch_start_ref = null
        is_swiping = false
    }

    function on_touch_cancel(){
        remove_target_listeners()

        if (is_swiping){
            on_swipe_end(false, 0)
        }
        touch_start_ref = null
        is_swiping = false
    }

    return {
        bind: (element: HTMLElement) => {
            bound_element = element
            element.addEventListener("touchstart", on_touch_start, { passive: true })

            return () => {
                element.removeEventListener("touchstart", on_touch_start)
                remove_target_listeners()
                bound_element = null
            }
        }
    }
}
