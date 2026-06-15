"use client"

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import type { ComponentPropsWithRef, ReactNode } from "react"
import { is_ios_device, vibrate } from "@/infra/device.client"
import { IOSHapticsContainer } from "@/components/base/IOSHapticContainer"
import { join_classes, is_element_hidden } from "@/components/utils"
import styles from "./ViewSwitcher.module.css"

export interface View<T extends string = string> {
    /** Unique identifier for the view/tab */
    id: T
    /** React node for the icon displayed in the navigation bar (optional) */
    icon?: ReactNode
    /** Label text or node displayed below the icon (optional) */
    label?: ReactNode
    /** Component or content to render when this view is selected */
    content: ReactNode
    /** Override global keep-alive setting for this specific tab */
    keep_alive?: boolean
    /** Override global scroll memory setting for this specific tab. Only effective when keep_alive resolves to true. */
    remember_scroll?: boolean
}

export type ViewSwitcherProps<T extends string = string> = Omit<ComponentPropsWithRef<"div">, "children" | "onChange"> & {
    /** List of view configurations */
    views: View<T>[]
    /** The active tab ID for controlled mode */
    active_view_id?: T
    /** Initial active tab ID for uncontrolled mode */
    default_active_view_id?: T
    /** Callback triggered when active view changes */
    on_view_change?: (view_id: T) => void
    /** Default keep-alive value if a tab doesn't specify keep_alive */
    keep_alive_default?: boolean
    /** Whether to automatically remember and restore scroll positions of keep-alive tabs */
    remember_scroll?: boolean
    /** Extra actions/buttons to display on the right side of the floating toolbar */
    toolbar_extra_actions?: ReactNode
    /** Custom class for the floating bottom bar */
    toolbar_className?: string
    /** Custom class for individual tab buttons */
    toolbar_item_className?: string
    /** Layout positioning: bottom floating (default) or top floating */
    toolbar_layout?: 'bottom-floating' | 'top-floating'
}

export function ViewSwitcher<T extends string = string>({
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

    const container_ref = useRef<HTMLDivElement>(null)
    const set_container_ref = useCallback((element: HTMLDivElement | null) => {
        container_ref.current = element

        if (typeof ref === "function"){
            ref(element)
            return
        }

        if (ref){
            ref.current = element
        }
    }, [ref])

    // Ref to store scroll positions of keep_alive tabs
    const scroll_positions = useRef<Record<string, number>>({})

    // Find the currently active tab configuration
    const active_tab = views.find((t) => t.id === current_active_id)
    const active_tab_keep_alive = active_tab?.keep_alive ?? keep_alive_default
    const active_tab_remember_scroll = active_tab_keep_alive && (active_tab?.remember_scroll ?? remember_scroll)

    // Listen to scroll events and save position
    useEffect(() => {
        if (!active_tab_remember_scroll) return

        const handle_scroll = () => {
            // If the switcher container itself or any ancestor is hidden (display: none), do not record scroll
            if (is_element_hidden(container_ref.current)){
                return
            }
            scroll_positions.current[current_active_id] = window.scrollY
        }

        window.addEventListener("scroll", handle_scroll, { passive: true })
        return () => window.removeEventListener("scroll", handle_scroll)
    }, [current_active_id, active_tab_remember_scroll])

    // Restore scroll position when active tab changes
    useLayoutEffect(() => {
        if (active_tab_remember_scroll){
            const saved_pos = scroll_positions.current[current_active_id] ?? 0
            window.scrollTo(0, saved_pos)
        }
        else{
            window.scrollTo(0, 0)
        }
    }, [current_active_id, active_tab_remember_scroll])

    const handle_tab_click = (tab_id: T) => {
        if (!is_ios_device()){
            vibrate()
        }
        if (active_view_id === undefined){
            set_internal_active_id(tab_id)
        }
        on_view_change?.(tab_id)
    }

    return (
        <div ref={set_container_ref} className={join_classes("w-full h-full", className)} {...props}>
            {/* Content Views Area */}
            <div className="w-full h-full">
                {views.map((tab) => {
                    const is_active = tab.id === current_active_id
                    const should_keep = tab.keep_alive ?? keep_alive_default

                    if (should_keep){
                        return (
                            <div
                                key={tab.id}
                                className={is_active ? "block w-full h-full" : "hidden"}
                            >
                                {tab.content}
                            </div>
                        )
                    }

                    if (is_active){
                        return (
                            <div key={tab.id} className="block w-full h-full">
                                {tab.content}
                            </div>
                        )
                    }

                    return null
                })}
            </div>

            {/* Floating Bottom/Top Navigation Bar */}
            <div
                className={join_classes(
                    toolbar_layout === "top-floating"
                        ? `top-[max(env(safe-area-inset-top),12px)] ${styles["viewswitcher-toolbar-top"]}`
                        : `bottom-3 ${styles["viewswitcher-toolbar-bottom"]}`,
                    "fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5",
                    "bg-white/40 dark:bg-black/40 backdrop-blur-md",
                    "p-1 rounded-full",
                    "border border-black/10 dark:border-white/10 shadow-lg",
                    styles["viewswitcher-toolbar"],
                    toolbar_className
                )}
            >
                {/* Navigation Tabs */}
                <div className="rounded-full border border-black/10 dark:border-white/10 p-1">
                    <div className="inline-flex flex-row items-center p-1 bg-background/0! backdrop-blur-none!">
                        {views.map((tab) => {
                            const is_active = tab.id === current_active_id
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className="focus-visible:outline-none"
                                    onClick={() => handle_tab_click(tab.id)}
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
                                                            ? (tab.icon ? "text-red-700 dark:text-red-500" : "text-black dark:text-white")
                                                            : "text-black/50 dark:text-white/50"
                                                    )}
                                                >
                                                    {tab.icon}
                                                    {tab.label && (
                                                        <span
                                                            className={join_classes(
                                                                tab.icon ? "text-[9px] mt-0.5 font-medium" : "text-[10px] sm:text-xs font-semibold",
                                                                is_active && !tab.icon ? "font-bold" : ""
                                                            )}
                                                        >
                                                            {tab.label}
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
