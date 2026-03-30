"use client"

import { vibrate } from "@/infra/device.client"
import {
    forwardRef,
    type CSSProperties,
    type ComponentPropsWithoutRef,
    type ReactNode,
    useCallback,
    useState,
} from "react"

type VerticalMenuBarItem = {
    key: string
    label: ReactNode
    description?: ReactNode
    icon?: ReactNode
    badge?: ReactNode
    trailing?: ReactNode
    disabled?: boolean
    tone?: "default" | "destructive"
    onClick?: () => void
}

type VerticalMenuBarSection = {
    key?: string
    title?: ReactNode
    caption?: ReactNode
    items: VerticalMenuBarItem[]
}

type VerticalMenuBarProps = Omit<ComponentPropsWithoutRef<"nav">, "children" | "onSelect"> & {
    sections: VerticalMenuBarSection[]
    selected_key?: string
    default_selected_key?: string
    onSelect?: (key: string, item: VerticalMenuBarItem) => void
    header?: ReactNode
    footer?: ReactNode
    compact?: boolean
    accent_color?: string
    enable_vibration?: boolean
}

const VerticalMenuBar = forwardRef<HTMLElement, VerticalMenuBarProps>(function VerticalMenuBar(
    {
        sections,
        selected_key,
        default_selected_key,
        onSelect,
        header,
        footer,
        compact = false,
        accent_color = "#0a84ff",
        enable_vibration = true,
        className = "",
        style,
        ...props
    },
    ref
) {
    const [inner_selected_key,set_inner_selected_key] = useState(default_selected_key)
    const current_selected_key = selected_key ?? inner_selected_key

    const handle_select = useCallback((item: VerticalMenuBarItem) => {
        if (item.disabled) {
            return
        }
        if (enable_vibration) {
            vibrate()
        }
        if (selected_key === undefined) {
            set_inner_selected_key(item.key)
        }
        onSelect?.(item.key, item)
        item.onClick?.()
    }, [enable_vibration, onSelect, selected_key])

    return (
        <nav
            ref={ref}
            style={{
                "--vertical-menu-accent-color": accent_color,
                "--vertical-menu-accent-soft-color": `color-mix(in srgb, ${accent_color} 18%, transparent)`,
                "--vertical-menu-accent-border-color": `color-mix(in srgb, ${accent_color} 28%, white)`,
                ...style,
            } as CSSProperties}
            className={[
                "rounded-[30px] border border-black/8 bg-white/78 p-2.5 text-black/88 shadow-[0_18px_48px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-2xl",
                "dark:border-white/10 dark:bg-[#111111]/78 dark:text-white/88 dark:shadow-[0_20px_52px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]",
                className,
            ].filter(Boolean).join(" ")}
            {...props}
        >
            {header &&
                <div className="px-3.5 pb-3 pt-1">
                    {header}
                </div>}

            <div className="flex flex-col gap-2">
                {sections.map((section, section_index) => {
                    return (
                        <section
                            key={section.key || `${section_index}`}
                            className="rounded-[24px] bg-black/[0.025] p-1.5 dark:bg-white/[0.035]"
                        >
                            {(section.title || section.caption) &&
                                <div className="px-3 pb-2 pt-2">
                                    {section.title &&
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/42 dark:text-white/42">
                                            {section.title}
                                        </div>}
                                    {section.caption &&
                                        <div className="mt-1 text-xs text-black/48 dark:text-white/48">
                                            {section.caption}
                                        </div>}
                                </div>}

                            <div className="flex flex-col gap-1">
                                {section.items.map(item => {
                                    const is_selected = item.key === current_selected_key
                                    const is_destructive = item.tone === "destructive"

                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            disabled={item.disabled}
                                            aria-current={is_selected ? "page" : undefined}
                                            onClick={() => {
                                                handle_select(item)
                                            }}
                                            className={[
                                                "group relative flex w-full items-center rounded-[22px] text-left transition duration-300 ease-in-out",
                                                compact ? "gap-3 px-3 py-2.5" : "gap-3.5 px-3.5 py-3",
                                                item.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                                                is_selected
                                                    ? "border border-[var(--vertical-menu-accent-border-color)] bg-[linear-gradient(180deg,var(--vertical-menu-accent-soft-color),color-mix(in_srgb,var(--vertical-menu-accent-color)_11%,transparent))] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_22px_color-mix(in_srgb,var(--vertical-menu-accent-color)_15%,transparent)]"
                                                    : "border border-transparent hover:bg-white/72 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_rgba(15,23,42,0.08)] active:scale-[0.992] dark:hover:bg-white/[0.07] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_20px_rgba(0,0,0,0.18)]",
                                            ].filter(Boolean).join(" ")}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={[
                                                    "flex shrink-0 items-center justify-center rounded-[18px] border text-[currentColor] shadow-[inset_0_1px_0_rgba(255,255,255,0.20)] transition duration-300 ease-in-out",
                                                    compact ? "h-9 w-9" : "h-10 w-10",
                                                    is_selected
                                                        ? "border-[var(--vertical-menu-accent-border-color)] bg-white/82 text-[var(--vertical-menu-accent-color)]"
                                                        : "border-black/6 bg-white/72 text-black/68 dark:border-white/8 dark:bg-white/[0.05] dark:text-white/72",
                                                    is_destructive && !is_selected ? "text-[#ff3b30]" : "",
                                                ].filter(Boolean).join(" ")}
                                            >
                                                {item.icon}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span
                                                    className={[
                                                        "block truncate text-[15px] font-semibold leading-[1.15]",
                                                        is_selected ? "text-[var(--vertical-menu-accent-color)]" : "",
                                                        is_destructive && !is_selected ? "text-[#ff3b30]" : "",
                                                    ].filter(Boolean).join(" ")}
                                                >
                                                    {item.label}
                                                </span>
                                                {item.description &&
                                                    <span className="mt-1 block truncate text-[12px] leading-[1.25] text-black/48 dark:text-white/48">
                                                        {item.description}
                                                    </span>}
                                            </span>

                                            {(item.badge || item.trailing) &&
                                                <span className="ml-2 flex shrink-0 items-center gap-2">
                                                    {item.badge &&
                                                        <span
                                                            className={[
                                                                "rounded-full px-2 py-1 text-[11px] font-semibold leading-none",
                                                                is_selected
                                                                    ? "bg-[var(--vertical-menu-accent-color)] text-white"
                                                                    : "bg-black/6 text-black/55 dark:bg-white/8 dark:text-white/62",
                                                            ].filter(Boolean).join(" ")}
                                                        >
                                                            {item.badge}
                                                        </span>}
                                                    {item.trailing &&
                                                        <span className="text-black/34 transition duration-300 ease-in-out group-hover:translate-x-[1px] dark:text-white/34">
                                                            {item.trailing}
                                                        </span>}
                                                </span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </section>
                    )
                })}
            </div>

            {footer &&
                <div className="px-3.5 pb-1 pt-3">
                    {footer}
                </div>}
        </nav>
    )
})

VerticalMenuBar.displayName = "VerticalMenuBar"

export type { VerticalMenuBarItem, VerticalMenuBarProps, VerticalMenuBarSection }
export { VerticalMenuBar }
