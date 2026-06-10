"use client"

import React from "react"
import { LabeledImage } from "./LabeledImage"
import { ContextMenu } from "./ContextMenuContainer"
import type { ComponentPropsWithRef, ReactNode } from "react"
import type { ContextMenuProps } from "./ContextMenuContainer"

export type LabeledRowProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
    // Cover image properties passed to the internal LabeledImage
    src?: string
    alt?: string
    image_className?: string
    image_proxy_api?: string
    onClickImage?: () => void

    // Layout slots
    left_indicator?: ReactNode // E.g., index numbers, playback status indicators
    title?: ReactNode          // Title of the video/song
    subtitle?: ReactNode       // Author/Channel/Muted information
    right_actions?: ReactNode   // Quick actions on the far right
    
    // Selection state
    is_active?: boolean        // If true, applies active visual styling (glowing/colors)
    
    // Context Menu config
    context_menu?: Omit<ContextMenuProps, "children" | "disabled" | "onClickTrigger">
    
    // Callbacks
    onClickRow?: () => void
}

const LabeledRow = React.memo(function LabeledRow({
    src,
    alt,
    image_className,
    image_proxy_api,
    left_indicator,
    title,
    subtitle,
    right_actions,
    is_active = false,
    context_menu,
    onClickRow,
    onClickImage,
    className = "",
    ref,
    ...props
}: LabeledRowProps){
    return (
        <ContextMenu
            sections={context_menu?.sections || []}
            {...context_menu}
            className={`w-full ${className}`}
            ref={ref}
        >
            {/* 
              Outer wrapper is responsible for unified visual states like hover, active background, and rounded borders.
              We keep click handling scoped to child containers to avoid event conflicts.
            */}
            <div
                {...props}
                className={`flex items-center justify-between p-2 rounded-xl transition-all duration-150 relative ${
                    is_active
                        ? "bg-red-500/10 dark:bg-red-500/5 shadow-sm"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                onTouchEnd={(event) => {
                    // Stop propagation to prevent ContextMenu's onTouchEnd from calling preventDefault(),
                    // which would otherwise block synthetic click events on iOS WebKit/Safari.
                    event.stopPropagation()
                }}
            >
                {/* Main clickable area: covers left indicator, thumbnail, and texts */}
                <div
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                    onClick={onClickRow}
                >
                    {/* Left status/index */}
                    {left_indicator != null && (
                        <div className="text-xs font-semibold w-6 text-center shrink-0 text-gray-400 dark:text-gray-500">
                            {left_indicator}
                        </div>
                    )}

                    {/* Thumbnail/Cover image (reuses LabeledImage for lazy-loading and offline generation) */}
                    <div className="w-20 sm:w-24 aspect-video shrink-0 rounded-lg overflow-hidden relative shadow-sm bg-black/10 dark:bg-white/5">
                        <LabeledImage
                            src={src}
                            alt={alt}
                            image_className={image_className}
                            image_proxy_api={image_proxy_api}
                            onClickImage={onClickImage}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Meta info (Title & Channel) */}
                    <div className="min-w-0 flex-1 ml-1">
                        <div className={`text-sm font-semibold line-clamp-1 transition-colors duration-150 ${
                            is_active
                                ? "text-red-600 dark:text-red-400 font-bold"
                                : "text-foreground group-hover:text-red-600 dark:group-hover:text-red-400"
                        }`}
                        >
                            {title}
                        </div>
                        {subtitle != null && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                {subtitle}
                            </div>
                        )}
                    </div>
                </div>

                {/* Independent actions block (sibling to avoid parent-click event propagation) */}
                {right_actions != null && (
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {right_actions}
                    </div>
                )}
            </div>
        </ContextMenu>
    )
})

export { LabeledRow }
