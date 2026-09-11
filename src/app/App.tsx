import { useState } from "react"
import { LaunchAnimation } from "@/blocks/LaunchAnimation"
import { Device } from "@/components"
import { Version } from "@/components"

export default function App(){
    const [show_launch_animation, set_show_launch_animation] = useState(true)

    return (
        <>
            {show_launch_animation &&
                <LaunchAnimation on_finish={() => set_show_launch_animation(false)} />}

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
