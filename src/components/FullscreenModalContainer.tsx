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
