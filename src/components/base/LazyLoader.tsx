import { useState, useEffect, useRef, ReactNode, RefObject, useCallback } from 'react'
import type { FC, ComponentPropsWithRef } from "react"
import { is_element_hidden } from "@/components/utils"

export type LazyContainerProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    children: ReactNode
    initial_placeholder?: ReactNode
    threshold?: number | number[]
    rootMargin?: string
    // Accepts a DOM Element, a React Ref object, or null (defaults to browser viewport)
    root?: Element | RefObject<Element | null> | null
}

const LazyContainer: FC<LazyContainerProps> = ({
    children,
    initial_placeholder = <div style={{ minHeight: '200px' }}>Loading...</div>,
    threshold = 0,
    rootMargin = '200px', // A larger margin is recommended for smoother scrolling
    root = null,
    className,
    ref,
    ...props
}) => {
    // Track visibility of the element in the viewport
    const [is_visible, set_is_visible] = useState<boolean>(false)
    // Track if the element has been rendered at least once
    const [has_loaded_once, set_has_loadedOnce] = useState<boolean>(false)
    // Store the exact dimensions before the element unmounts
    const [dimensions, set_dimensions] = useState<{ width: number; height: number } | null>(null)
  
    // Use a ref to access the latest loaded state inside the observer callback
    const hasLoaded_ref = useRef<boolean>(false)

    const element_ref = useRef<HTMLDivElement>(null)
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
        const rootElement = root && typeof root === 'object' && 'current' in root
            ? root.current
            : (root as Element | null)

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries

                if (entry.isIntersecting){
                    // The element enters the viewport
                    set_is_visible(true)
                    set_has_loadedOnce(true)
                    hasLoaded_ref.current = true
                }
                else {
                    // The element leaves the viewport
                    if (hasLoaded_ref.current && element_ref.current){
                        // If the element (or its parent) has display: none, skip unmounting to prevent layout collapse.
                        if (is_element_hidden(element_ref.current)){
                            return
                        }

                        const width = element_ref.current.offsetWidth
                        const height = element_ref.current.offsetHeight

                        // Capture the actual rendered dimensions just before hiding the content
                        set_dimensions({
                            width,
                            height,
                        })
                        // Unmount the real children to save memory
                        set_is_visible(false)
                    }
                }
            },
            {
                root: rootElement,
                rootMargin,
                threshold,
            }
        )

        const currentRef = element_ref.current
        if (currentRef){
            observer.observe(currentRef)
        }

        return () => {
            if (currentRef){
                observer.unobserve(currentRef)
            }
        }
    }, [threshold, rootMargin, root])

    // If the element is out of the viewport but was loaded before, 
    // lock its container size to prevent scrollbar layout shifts.
    const container_style: React.CSSProperties = (!is_visible && has_loaded_once && dimensions)
        ? { 
            width: `${dimensions.width}px`, 
            height: `${dimensions.height}px`,
            overflow: 'hidden' 
        }
        : {}

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
            // 2. Left viewport: render nothing, layout is preserved by containerStyle
                null 
            ) : (
            // 3. Initial state: render the user-provided placeholder
                initial_placeholder 
            )}
        </div>
    )
}

export { LazyContainer }
