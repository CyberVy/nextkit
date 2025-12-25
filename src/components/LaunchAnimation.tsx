"use client"

import { AnimatedGlowText } from "@/components/String"
import { useEffect, useState } from "react"
import { LabeledImage } from "@/components/LabeledImage"

function LaunchAnimation() {
    const [welcome_sentence,set_welcome_sentence] = useState("Struggling to wake... Just five more minutes.")
    const [is_amount, set_is_amount] = useState(false)
    useEffect(() => {
        set_is_amount(true)
        const welcome_sentences = [
            "Are we there yet? Oh, right. Waking up.",
            "Ugh, waking up is hard."
        ]
        setTimeout(() => set_welcome_sentence(welcome_sentences[Math.floor(Math.random() * welcome_sentences.length)]),500)
    }, [])
    return (
        <div className={"relative h-[calc(100vh-env(safe-area-inset-top))] w-[100vw]"}>
            <div className={`text-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
                <AnimatedGlowText
                    text={welcome_sentence}
                    stagger={0.06}
                />
            </div>
            <div className={`${is_amount ? "translate-x-[100vw]" : "-translate-x-1/1"} left-0 top-3/7 -translate-y-3/7 absolute transition duration-1500`}>
                <div className={"w-12 h-12"}>
                    <LabeledImage
                        src={"/icons/192x192.png"}
                    />
                </div>
            </div>
        </div>
    )
}
export { LaunchAnimation }