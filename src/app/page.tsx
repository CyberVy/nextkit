"use client"
import {useEffect, useState} from "react"
import { LaunchAnimation } from "@/components/LaunchAnimation"

export default function Page(){
    const [show_launch_animation, set_show_launch_animation] = useState(true)

    useEffect(() => {
        setTimeout(() => set_show_launch_animation(false),1500)
    }, [])

    // register service worker
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(() => {
                console.log('Service worker is registered successfully.')
            }).catch(err => {console.error('Failed to register Service worker.', err)})}
    }, [])

    return (
        <>
            {show_launch_animation &&
                <LaunchAnimation/>
            }

            <div className={`${show_launch_animation ? "hidden" : "block"}`}>
                <div className="text-center">
                    Hello World!
                </div>
            </div>

        </>
    )
}
