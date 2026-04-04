"use client"

import React, { useEffect, useState } from "react"
import { is_in_browser } from "@/infra/device.client"

const FullscreenModalContainer = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    function FullscreenModalContainer({ className = "", ...props }, ref) {
        const [in_browser,set_in_browser] = useState(true)

        useEffect(() => {
            set_in_browser(is_in_browser())
        }, [])

        return (
            <div
                ref={ref}
                className={[
                    "fixed left-0 top-0 w-[100vw] overflow-auto [scrollbar-width:none] overscroll-none",
                    "h-[100vh]",
                    // Keep 100vh as baseline in iOS containers without browser chrome (e.g. standalone/PWA).
                    // The issue is timing of dynamic viewport-related layout metrics (not dvh itself): values like offsetTop can settle later.
                    // Any CSS that depends on browser UI chrome, such as dvh or inset, can trigger the same delay.
                    in_browser ? "supports-[height:100dvh]:h-[100dvh]" : "",
                    "pt-[env(safe-area-inset-top)]",
                    className
                ].filter(Boolean).join(" ")}
                {...props}
            />
        )
    }
)

FullscreenModalContainer.displayName = "FullscreenModalContainer"

export { FullscreenModalContainer }


const FloatingModalContainer = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
    function FullscreenModalContainer({ className = "", children,...props }, ref) {
        return (
            <div
                ref={ref}
                className={[
                    "fixed",
                    "h-[20vh] w-[80vw]",
                    "rounded-[30px] border border-black/8 bg-white/78 p-2.5 text-black/88 shadow-[0_18px_48px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-2xl",
                    "dark:border-white/10 dark:bg-[#111111]/78 dark:text-white/88 dark:shadow-[0_20px_52px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]",
                    className
                ].filter(Boolean).join(" ")}
                {...props}
            >
                <div className={[
                    "overflow-auto overscroll-none [scrollbar-width:none] h-full w-full rounded-[30px] border border-black/8 bg-black/[0.025] p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.46)]",
                    "dark:border-white/10 dark:bg-white/[0.035] dark:text-white/88 dark:shadow-[0_14px_32px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)]"
                ].filter(Boolean).join(" ")}
                >
                    {children}
                </div>
            </div>
        )
    }
)

FloatingModalContainer.displayName = "FullscreenModalContainer"

export { FloatingModalContainer }
