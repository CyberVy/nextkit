"use client"

import { AnimatedGlowText } from "@/components"
import { useEffect, useState } from "react"
import { LabeledImage } from "@/components"
import { AnimationContainer } from "@/components"
import { join_classes } from "@/components/utils"

export type LaunchAnimationProps = {
    className?: string
    on_finish?: () => void
}

function LaunchAnimation({ className, on_finish }: LaunchAnimationProps){
    const [welcome_sentence, set_welcome_sentence] = useState("Struggling to wake... Just five more minutes.")
    useEffect(() => {
        const welcome_sentences = [
            "Are we there yet? Oh, right. Waking up.",
            "Ugh, waking up is hard."
        ]
        setTimeout(() => set_welcome_sentence(welcome_sentences[Math.floor(Math.random() * welcome_sentences.length)]), 500)
    }, [])
    return (
        <div
            className={join_classes("relative h-[calc(100vh-env(safe-area-inset-top))] w-screen overflow-hidden select-none", className)}
        >
            <div className={`absolute text-center left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
                <AnimatedGlowText
                    text={welcome_sentence}
                    stagger={0.06}
                />
            </div>

            <AnimationContainer
                show={true}
                duration={1500}
                easing="cubic-bezier(0.4, 0, 0.2, 1)"
                enter_from={{ transform: "translate(-100%, -100%)" }}
                enter_to={{ transform: "translate(100vw, -100%)" }}
                on_enter_end={on_finish}
                className="left-0 top-3/7 absolute"
                style={{ transform: "translate(-100%, -100%)" }}
            >
                <div className={"w-12 h-12"}>
                    <LabeledImage
                        image_class_name={"rounded-xl"}
                        src={"/icons/192x192.png"}
                    />
                </div>
            </AnimationContainer>
        </div>
    )
}
export { LaunchAnimation }