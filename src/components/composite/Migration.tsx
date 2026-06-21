"use client"

import { useState } from "react"
import { NaiveButton } from "../base/Buttons"
import { MigrationService } from "@/infra"
import { BodyPortal } from "@/components/base/Portal"
import { FloatingModalContainer } from "@/components/composite/ModalContainer"
import { AnimationContainer } from "@/components/animation/AnimationContainer"
import { string_icons } from "@/components/ui_constants"
import type { ReactNode } from "react"

type MigrationAlertModalProps = {
    show: boolean
    message: ReactNode
    title?: string
    on_close: () => void
}

function MigrationAlertModal({
    show,
    message,
    title = "Notice",
    on_close
}: MigrationAlertModalProps){

    return (
        <BodyPortal>
            {/* Modal dialog */}
            <AnimationContainer
                enter_from={{ transform: "scale(0)" }}
                enter_to={{ transform: "scale(1)" }}
                show={show}
                className="fixed top-1/2 left-1/2 z-100"
            >
                <FloatingModalContainer className="w-80! h-auto! min-h-40! p-1! top-1/2 left-1/2 -translate-1/2 select-none">
                    <div className="flex flex-col justify-between h-full w-full p-2">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-black/85 dark:text-white/85">
                                    {title}
                                </span>
                            </div>
                            <NaiveButton
                                className="backdrop-blur-none! bg-white/0! dark:bg-black/0!"
                                width="28px"
                                height="28px"
                                icon={string_icons.close}
                                on_click={on_close}
                            />
                        </div>
                        {/* Content */}
                        <div className="text-xs text-black/70 dark:text-white/70 leading-relaxed mb-4 whitespace-pre-wrap grow flex items-center justify-center text-center px-2">
                            {message}
                        </div>
                        {/* Action */}
                        <div className="flex justify-end pt-2 border-t border-black/5 dark:border-white/5">
                            <NaiveButton
                                className="backdrop-blur-none! bg-white/0! dark:bg-black/0!"
                                width="64px"
                                height="30px"
                                icon={<span className="text-xs font-semibold">OK</span>}
                                on_click={on_close}
                            />
                        </div>
                    </div>
                </FloatingModalContainer>
            </AnimationContainer>
        </BodyPortal>
    )
}

function useMigrationAlert(){
    const [open, set_open] = useState(false)
    const [title, set_title] = useState("")
    const [message, set_message] = useState("")
    const [on_close_callback, set_on_close_callback] = useState<(() => void) | null>(null)

    const trigger_alert = (new_title: string, new_message: string, on_close?: () => void) => {
        set_title(new_title)
        set_message(new_message)
        set_on_close_callback(() => on_close || null)
        set_open(true)
    }

    const handle_close = () => {
        set_open(false)
        if (on_close_callback){
            on_close_callback()
        }
    }

    const alert_element = (
        <MigrationAlertModal
            show={open}
            title={title}
            message={message}
            on_close={handle_close}
        />
    )

    return { trigger_alert, alert_element }
}

export type MigrationExportProps = {
    app_id: string
    app_version: string
    local_keys?: string[]
    width?: string
    height?: string
    icon?: React.ReactNode
    className?: string
}

export function MigrationExport({
    app_id,
    app_version,
    local_keys,
    width = "112px",
    height = "30px",
    icon = <span className="text-xs font-medium">Export Backup</span>,
    className = ""
}: MigrationExportProps){

    const handle_export = async () => {
        await MigrationService.export_file(app_id, app_version, local_keys)
    }

    return (
        <>
            <NaiveButton
                width={width}
                height={height}
                icon={icon}
                on_click={handle_export}
                className={className}
            />
        </>
    )
}

export type MigrationMergeProps = {
    app_id: string
    merge_rules?: Record<string, { identity_key: string | string[] }>
    width?: string
    height?: string
    icon?: React.ReactNode
    className?: string
}

export function MigrationMerge({
    app_id,
    merge_rules,
    width = "64px",
    height = "30px",
    icon = <span className="text-xs font-medium">Merge</span>,
    className = ""
}: MigrationMergeProps){
    const { trigger_alert, alert_element } = useMigrationAlert()

    const handle_import = async () => {
        const content = await MigrationService.read_file()
        if (!content) return

        const options = {
            mode: "merge" as const,
            merge_rules
        }

        const result = await MigrationService.restore_from_backup_data(content, app_id, options)
        if (result.success){
            trigger_alert(
                "Restore Success",
                `Backup restored successfully. And ${app_id} will reload to apply changes.`,
                () => {
                    window.location.reload()
                }
            )
        } 
        else {
            trigger_alert(
                "Restore Failed",
                "Restore failed: " + (result.error || "Unknown error"),
            )
        }
    }

    return (
        <>
            <NaiveButton
                width={width}
                height={height}
                icon={icon}
                on_click={handle_import}
                className={className}
            />
            {alert_element}
        </>
    )
}

export type MigrationOverwriteProps = {
    app_id: string
    width?: string
    height?: string
    icon?: React.ReactNode
    background_color?: string
    background_color_dark?: string
    border_color?: string
    border_color_dark?: string
    className?: string
}

export function MigrationOverwrite({
    app_id,
    width = "80px",
    height = "30px",
    icon = <span className="text-xs font-medium text-red-600 dark:text-red-400">Overwrite</span>,
    background_color = "rgba(239, 68, 68, 0.1)",
    background_color_dark = "rgba(239, 68, 68, 0.15)",
    border_color = "rgba(239, 68, 68, 0.2)",
    border_color_dark = "rgba(239, 68, 68, 0.25)",
    className = ""
}: MigrationOverwriteProps){
    const { trigger_alert, alert_element } = useMigrationAlert()

    const handle_import = async () => {
        const content = await MigrationService.read_file()
        if (!content) return

        const options = {
            mode: "overwrite" as const
        }

        const result = await MigrationService.restore_from_backup_data(content, app_id, options)
        if (result.success){
            trigger_alert(
                "Restore Success",
                `Backup restored successfully! And ${app_id} will reload to apply changes.`,
                () => {
                    window.location.reload()
                }
            )
        } 
        else {
            trigger_alert(
                "Restore Failed",
                "Restore failed: " + (result.error || "Unknown error"),
            )
        }
    }

    return (
        <>
            <NaiveButton
                width={width}
                height={height}
                icon={icon}
                on_click={handle_import}
                background_color={background_color}
                background_color_dark={background_color_dark}
                border_color={border_color}
                border_color_dark={border_color_dark}
                className={className}
            />
            {alert_element}
        </>
    )
}
