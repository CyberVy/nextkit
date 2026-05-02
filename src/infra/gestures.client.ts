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
}

const is_gesture_enabled = <TEvent, >(enabled: GestureEnabled<TEvent> | undefined, event: TEvent) => {
    if (typeof enabled === "function"){
        return enabled(event)
    }

    return enabled ?? true
}

export function create_press_gesture<TEvent extends { clientX: number, clientY: number }>({
    click,
    on_cancel,
    on_success,
    enabled,
    long_press,
    move_threshold = 10,
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

    const on_pointer_down = (event: TEvent) => {
        if (!is_gesture_enabled(enabled, event)){
            reset_press()
            return
        }

        reset_press()
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
        if (!start_event || long_pressing) return

        const moved_x = event.clientX - start_client_x
        const moved_y = event.clientY - start_client_y

        if (Math.hypot(moved_x, moved_y) < move_threshold) return

        cancel_press("move", event)
    }

    const on_pointer_up = (event: TEvent) => {
        if (!start_event) return

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
        if (long_pressing){
            long_press?.on_end?.(event)
            reset_press()
            return
        }

        cancel_press("cancel", event)
    }

    const on_pointer_leave = (event: TEvent) => {
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
