import { useState, useEffect, useRef, ReactNode, RefObject, useCallback } from 'react'
import type { FC, ComponentPropsWithRef } from "react"
import { is_element_hidden } from "@/components/utils"

export type KeepLoadedMargin = {
    top?: number
    bottom?: number
    left?: number
    right?: number
}

export type LazyContainerProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    children: ReactNode
    // The placeholder element should have the same dimensions as the children to avoid layout shifts (CLS).
    // These dimensions must be set in advance before the initial layout occurs.
    initial_placeholder?: ReactNode
    threshold?: number | number[]
    rootMargin?: string
    // Accepts a DOM Element, a React Ref object, or null (defaults to browser viewport)
    root?: Element | RefObject<Element | null> | null
    keep_loaded_margin?: KeepLoadedMargin
}

const DEFAULT_PLACEHOLDER = <div style={{ minHeight: '200px' }}>Loading...</div>

const LazyContainer: FC<LazyContainerProps> = ({
    children,
    initial_placeholder = DEFAULT_PLACEHOLDER,
    threshold = 0,
    rootMargin,
    root = null,
    keep_loaded_margin,
    className,
    style,
    ref,
    ...props
}) => {
    // Resolve rootMargin from rootMargin prop or convert keep_loaded_margin to native rootMargin string
    const resolved_root_margin = rootMargin || (
        keep_loaded_margin
            ? `${keep_loaded_margin.top ?? 200}px ${keep_loaded_margin.right ?? 0}px ${keep_loaded_margin.bottom ?? 200}px ${keep_loaded_margin.left ?? 0}px`
            : '200px'
    )

    // Track visibility of the element in the viewport
    const [is_visible, set_is_visible] = useState<boolean>(false)
    // Track if the element has been rendered at least once
    const [has_loaded_once, set_has_loaded_once] = useState<boolean>(false)
    // Store exact height before unmounting to preserve vertical layout and prevent CLS
    const [height, set_height] = useState<number | null>(null)
  
    // Use a ref to access the latest loaded state inside the observer callback
    const has_loaded_ref = useRef<boolean>(false)

    const element_ref = useRef<HTMLDivElement | null>(null)

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

    useEffect(() => {
        // Resolve the root element whether passed as a DOM node or a React ref object
        const root_element = root && typeof root === 'object' && 'current' in root
            ? root.current
            : (root as Element | null)

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries

                if (entry.isIntersecting){
                    // The element enters the viewport
                    set_is_visible(true)
                    set_has_loaded_once(true)
                    has_loaded_ref.current = true
                }
                else {
                    // The element leaves the viewport
                    if (has_loaded_ref.current && element_ref.current){
                        // If the element (or its parent) is hidden, skip unmounting to prevent layout collapse
                        if (is_element_hidden(element_ref.current)){
                            return
                        }

                        // Capture only height to lock vertical dimension without breaking responsive width
                        set_height(entry.boundingClientRect.height)
                        set_is_visible(false)
                    }
                }
            },
            {
                root: root_element,
                rootMargin: resolved_root_margin,
                threshold,
            }
        )

        const current_ref = element_ref.current
        if (current_ref){
            observer.observe(current_ref)
        }

        return () => {
            if (current_ref){
                observer.unobserve(current_ref)
            }
        }
    }, [
        threshold,
        resolved_root_margin,
        root
    ])

    // Lock height when element is unmounted to preserve layout scrollbar space
    const container_style: React.CSSProperties = (!is_visible && has_loaded_once && height !== null)
        ? { 
            height: `${height}px`,
            overflow: 'hidden',
            ...style
        }
        : style || {}

    return (
        <div
            {...props}
            ref={set_element_ref} 
            style={container_style}
            className={className}
        >
            {is_visible ? (
                // 1. In viewport: render the actual content
                children 
            ) : has_loaded_once ? (
                // 2. Left viewport: render nothing, layout is preserved by container_style height
                null 
            ) : (
                // 3. Initial state: render the user-provided placeholder
                initial_placeholder 
            )}
        </div>
    )
}

export { LazyContainer }
