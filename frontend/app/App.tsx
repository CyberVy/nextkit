import { useState } from "react"
import { LaunchAnimation } from "@/blocks/LaunchAnimation"

export default function App() {
    const [show_launch_animation, set_show_launch_animation] = useState(true)

    return (
        <>
            <div className="select-none" {...(show_launch_animation ? { inert: true } : {})}>
                <div className="fixed left-1/2 top-1/2 -translate-1/2">
                    <div>Hello from Nextkit! {">_"}</div>
                </div>
            </div>

            {show_launch_animation && <LaunchAnimation on_finish={() => set_show_launch_animation(false)} />}
        </>
    )
}
