import type { CoverImageOptions } from "@/infra/types"
import { is_in_dark } from "@/infra/device.client"

type PendingHtmlIcon = "search" | "loading" | "clipboard" | "chat" | "external_link" | "none"

type PendingHtmlOptions = {
    title: string
    message: string
    note?: string
    icon?: PendingHtmlIcon
}

export function generate_silent_wav_base64(durationSec = 5, sampleRate = 8000){

    const numChannels = 1
    const bitsPerSample = 16
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
    const blockAlign = (numChannels * bitsPerSample) / 8
    const numSamples = durationSec * sampleRate
    const dataSize = numSamples * blockAlign
    const buffer = Buffer.alloc(44 + dataSize)

    // RIFF header
    buffer.write("RIFF", 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write("WAVE", 8)

    // fmt subchunk
    buffer.write("fmt ", 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20) // PCM
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(byteRate, 28)
    buffer.writeUInt16LE(blockAlign, 32)
    buffer.writeUInt16LE(bitsPerSample, 34)

    // data subchunk
    buffer.write("data", 36)
    buffer.writeUInt32LE(dataSize, 40)

    // samples are all zero (silence)
    // Buffer is already zero-filled

    return "data:audio/wav;base64," + buffer.toString("base64")
}

export function generate_cover_image(title: string, options:CoverImageOptions){
    const {
        width = 1024,
        height = 720,
        background = "#333",
        color = "#fff",
        fontSize = 48,
        fontFamily = "sans-serif",
    } = options

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (ctx){
        ctx.fillStyle = background
        ctx.fillRect(0, 0, width, height)

        // Add a black border
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 1
        ctx.strokeRect(0, 0, width, height)

        ctx.fillStyle = color
        ctx.font = `${fontSize}px ${fontFamily}`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(title, width / 2, height / 2)
    }

    return new Promise<string>(resolve => {
        canvas.toBlob(blob => {
            if (blob){
                resolve(URL.createObjectURL(blob))
            }
            else {
                resolve("")
            }
        }, "image/png")
    })
}

function escape_html(text: string){
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
}

function escape_html_with_line_break(text: string){
    return escape_html(text).replaceAll("\n", "<br>")
}

function generate_pending_html_icon(icon: PendingHtmlIcon){
    if (icon === "search"){
        return `
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none" />
                <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>`
    }
    if (icon === "clipboard"){
        return `
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="7" y="5" width="10" height="15" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none" />
                <path d="M9 5.5H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <rect x="9" y="2.5" width="6" height="4" rx="1.5" ry="1.5" stroke="currentColor" stroke-width="2" fill="none" />
            </svg>`
    }
    if (icon === "chat"){
        return `
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6 18L4 20V6C4 4.9 4.9 4 6 4H18C19.1 4 20 4.9 20 6V16C20 17.1 19.1 18 18 18H6Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round" />
                <path d="M8 9H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M8 13H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>`
    }
    if (icon === "external_link"){
        return `
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 5H19V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                <path d="M19 5L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M19 13V18C19 19.1 18.1 20 17 20H6C4.9 20 4 19.1 4 18V7C4 5.9 4.9 5 6 5H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>`
    }
    if (icon === "none"){
        return ""
    }

    return `
        <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none" opacity="0.35" />
            <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
        </svg>`
}

export function generate_pending_html({ title, message, note = "", icon = "loading" }: PendingHtmlOptions){

    const background_color = is_in_dark() ? "#000000" : "#FFFFFF"
    const text_color = is_in_dark() ? "#EEEEEE" : "#000000"
    const safe_title = escape_html(title)
    const safe_message = escape_html_with_line_break(message)
    const safe_note = escape_html_with_line_break(note)

    return `
        <!DOCTYPE html>
        <html style="background-color: ${background_color}; height: 100%">
            <head>
                <title>${safe_title}</title>
                <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
            </head>
            <body style="background-color: ${background_color}; color: ${text_color}; overflow: auto">
                <div style="margin-top: 32px; margin-bottom: 8px; text-align: center;">
                    ${generate_pending_html_icon(icon)}
                </div>
                <div style="margin-top: 8px; margin-bottom: 8px; font-size: 20px; text-align: center;">
                    ${safe_message}
                </div>
                ${note ? `
                    <div style="text-align: center;">
                        <div style="padding: 8px 16px; border: 1px solid ${text_color}; border-radius: 16px; background-color: ${background_color}; opacity: 0.8; font-size: 18px;  display: inline-block">
                            ${safe_note}
                        </div>
                    </div>
                    ` : ""}
            </body>
        </html>`
}
