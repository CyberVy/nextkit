
"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

/**
* Render children into document.body。
* Useful for overlays that must escape parent layout, scroll, and stacking contexts.
*/
function BodyPortal({ children }: { children: React.ReactNode }){
    const [mounted, set_mounted] = useState(false)

    useEffect(() => {
        set_mounted(true)
    }, [])

    if (!mounted) return null

    return createPortal(children, document.body)
}

export { BodyPortal }
