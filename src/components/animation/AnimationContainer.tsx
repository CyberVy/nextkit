"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AnimationContainerProps } from "@/components/animation/types"

/**
 * Ensure the container and its children stay visually aligned before using this wrapper.
 * This is especially important when children include `absolute`, `fixed`, or other positioned content.
 * If the children are laid out against a different coordinate system than the container,
 * the animation's reference coordinates can become incorrect.
 * The failure mode may also differ across browser engines because their implementations are not identical.
 */
const AnimationContainer = function AnimationContainer({
    show = true, children, className, style,
    duration = 300, delay = 0, easing = "ease-in-out",
    enter_from, enter_to, exit_from, exit_to,
    on_enter_start, on_enter_end, on_exit_start, on_exit_end,
    unmount_on_exit = false, animate_on_mount = true,
    ref,
    ...props
}: AnimationContainerProps){

    const element_ref = useRef<HTMLDivElement>(null)
    const animation_ref = useRef<Animation | null>(null)
    const set_element_ref = useCallback((element: HTMLDivElement | null) => {
        element_ref.current = element

        if (typeof ref === "function"){
            ref(element)
            return
        }

        if (ref){
            ref.current = element
        }
    }, [ref])
    const [render_mode, set_render_mode] = useState<"pending" | "entering" | "visible" | "exiting_to_hidden" | "hidden" | "exiting_to_unmount" | "unmount">(() => {
        if (show){
            return "pending"
        }
        else if (unmount_on_exit){
            return "unmount"
        }
        else {
            return "hidden"
        }
    })

    useEffect(() => {
        if (show){
            if (render_mode === "pending"){
                if (animate_on_mount){
                    set_render_mode("entering")
                }
                else {
                    set_render_mode("visible")
                    return
                }
            }
            else if (render_mode === "entering"){ return }
            else if (render_mode === "visible"){ return }
            else if (render_mode === "exiting_to_hidden"){ set_render_mode("entering") }
            else if (render_mode === "hidden"){ set_render_mode("entering") }
            else if (render_mode === "exiting_to_unmount"){ set_render_mode("entering") }
            else if (render_mode === "unmount"){ set_render_mode("entering")}
        }
        else {
            if (render_mode === "pending"){ return }
            else if (render_mode === "entering"){ set_render_mode(unmount_on_exit? "exiting_to_unmount" : "exiting_to_hidden") }
            else if (render_mode === "visible"){ set_render_mode(unmount_on_exit? "exiting_to_unmount" : "exiting_to_hidden") }
            else if (render_mode === "exiting_to_hidden"){ return }
            else if (render_mode === "hidden"){ return }
            else if (render_mode === "exiting_to_unmount"){ return}
            else if (render_mode === "unmount"){ return }
        }

        const element = element_ref.current
        if (!element) return

        animation_ref.current?.cancel()

        const animation = element.animate(
            show ? [enter_from, enter_to] : [exit_from || enter_to, exit_to || enter_from],
            {
                duration,
                delay,
                easing,
                fill: "forwards",
            }
        )

        animation_ref.current = animation

        if (show){
            on_enter_start?.()
            set_render_mode("entering")
        }
        else {
            on_exit_start?.()
            set_render_mode(unmount_on_exit? "exiting_to_unmount" : "exiting_to_hidden")
        }

        animation.finished.then(() => {
            if (animation_ref.current !== animation) return

            animation_ref.current = null

            if (show){
                on_enter_end?.()
                set_render_mode("visible")
            }
            else {
                on_exit_end?.()
                if (unmount_on_exit){
                    set_render_mode("unmount")
                }
                else {
                    set_render_mode("hidden")
                }
            }
        }).catch(() => {})

        return () => {
            if (animation_ref.current === animation){
                animation_ref.current = null
            }
            animation.cancel()
        }
    }, [show])

    if (!["hidden", "unmount"].includes(render_mode) || show){
        return (
            <div
                {...props}
                ref={set_element_ref}
                className={className}
                style={style}
            >
                {children}
            </div>
        )
    }
    else if (render_mode === "hidden"){
        return (
            <div
                {...props}
                ref={set_element_ref}
                className={className}
                style={style}
                hidden={true}
            >
                {children}
            </div>
        )
    }
    return null
}

AnimationContainer.displayName = "AnimationContainer"

export { AnimationContainer }
