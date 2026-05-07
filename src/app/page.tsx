"use client"
import { useEffect, useState } from "react"
import { LaunchAnimation } from "@/blocks/LaunchAnimation"
import { Device } from "@/components"
import { Version } from "@/components"

export default function Page(){
    const [show_launch_animation, set_show_launch_animation] = useState(true)

    useEffect(() => {
        setTimeout(() => set_show_launch_animation(false), 1500)
    }, [])

    // register service worker
    useEffect(() => {
        if ('serviceWorker' in navigator){
            navigator.serviceWorker.register('/sw.js').then(() => {
                console.log('Service worker is registered successfully.')
            }).catch(err => {console.error('Failed to register Service worker.', err)})
        }
    }, [])

    return (
        <>
            {show_launch_animation &&
                <LaunchAnimation/>}

            <div className={`${show_launch_animation ? "hidden" : "block"}`}>
                <div className="fixed left-1/2 top-1/2 -translate-1/2">
                    <div className="pb-1 border-b dark:border-white/30 mb-1 border-black/30">
                        Hello from Nextkit! {">_"}
                    </div>
                    <Version/>
                    <Device/>
                </div>
            </div>

        </>
    )
}
