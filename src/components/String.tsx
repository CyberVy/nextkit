"use client"

import { useEffect, useState, type ComponentPropsWithRef } from "react"

type AnimatedGlowTextProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    text?: string
    duration?: number
    stagger?: number
    tailwind_cls_for_string_item?: string
}

const AnimatedGlowText = function AnimatedGlowText({
    text = "Hello World",
    duration = 1.8,
    stagger = 0.06,
    tailwind_cls_for_string_item = "",
    className = "",
    ref,
    ...props
}: AnimatedGlowTextProps){
    const [text_list, set_text_list] = useState<string[]>([])
    // some complicated CSS styles (e.g. animation styles) can not appear in the initial html for iOS PWA.
    // because a webkit bug can cause a brief flicker sometimes, especially for some low-end device
    // the resolution is rendering this component within useEffect
    useEffect(() => {
        set_text_list(text.split(""))
    }, [text])

    return (
        <div
            {...props}
            ref={ref}
            className={["inline", className].filter(Boolean).join(" ")}
        >
            {text_list.map((ch, index) => (
                <span
                    key={index}
                    className={`animate-pulse brightness-125 ${tailwind_cls_for_string_item}`}
                    style={{
                        animationDelay: `${index * stagger}s`,
                        animationDuration: `${duration}s`,
                    }}
                >
                    {ch}
                </span>
            ))}
        </div>
    )
}

AnimatedGlowText.displayName = "AnimatedGlowText"

export { AnimatedGlowText }
