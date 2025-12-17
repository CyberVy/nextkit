"use client"
import { useEffect } from "react"

export default function Page(){

    // register service worker
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(() => {
                console.log('Service worker is registered successfully.')
            }).catch(err => {console.error('Failed to register Service worker.', err)})}
    }, [])

    return (
        <div className="text-center">
            Hello World!
        </div>
    )
}
