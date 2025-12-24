import { RefObject, useEffect, useRef, useState } from "react"

/** margin: when the content is beyond the margin of the viewport, it will be defined as not in view
 *
 *  protected_padding: keep the contents which are within the top or bottom 'protected_padding' in view to prevent repeating renders
 **/
export function useInViewport<T extends HTMLElement,_T extends HTMLElement>(margin?: number, protected_padding = 0,threshold = 0) {
    const element_ref = useRef<T>(null)
    const root_element_ref = useRef<_T>(null)
    const [in_view, set_in_view] = useState(!margin)

    useEffect(() => {
        if (margin == undefined) return
        if (!element_ref.current) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!element_ref.current) {
                    set_in_view(false)
                    return
                }
                const root_element = root_element_ref.current || document.documentElement
                if (protected_padding){
                    if (element_ref.current!.offsetTop - root_element.offsetTop <= protected_padding || element_ref.current!.offsetTop - root_element.offsetTop >= root_element.scrollHeight - protected_padding){
                        set_in_view(true)
                        return
                    }
                }

                set_in_view(entry.isIntersecting)
            })
        }, { threshold: threshold, rootMargin: `${margin}px`, root: root_element_ref.current })
        observer.observe(element_ref.current)

        return () => observer.disconnect()
    }, [])

    return { element_ref: element_ref, in_view: in_view, root_element_ref: root_element_ref }
}

// create an auto sync state and ref object
export function useAutoSyncRefAndState<T>(value: T): [RefObject<T>,(value: T | ((prev: T) => T)) => void,T] {
    const [state, set_state] = useState(value)
    const state_ref = useRef(value)
    const dispatch_func = (value: T | ((prev: T) => T)) => {
        if (typeof value !== "function"){
            set_state(value)
            state_ref.current = value
        }
        else {
            const f = value as (prev: T) => T
            const r = f(state_ref.current)
            set_state(r)
            state_ref.current = r
        }
    }
    return [state_ref,dispatch_func,state]
}
