"use client"

const AnimatedGlowText = ({ text = "Hello World", duration = 1.8, stagger = 0.06, tailwind_cls_for_string_item = ""}) => {

    return (
        <div className="inline">
            {text.split("").map((ch, index) => (
                <span
                    key={index}
                    className={`animate-pulse brightness-125 ${tailwind_cls_for_string_item}`}
                    style={{
                        animationDelay: `${index * stagger}s`,
                        animationDuration: `${duration}s`,
                    }}
                >
                    {ch}
                </span>
            ))}
        </div>
    )
}

export { AnimatedGlowText }
