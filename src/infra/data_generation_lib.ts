import type { CoverImageOptions } from "@/infra/types"

export function generate_silent_wav_base64(durationSec = 2, sampleRate = 44100) {

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

export function generate_cover_image(title: string, options:CoverImageOptions) {
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
            if (blob) {
                resolve(URL.createObjectURL(blob))
            } else {
                resolve("")
            }
        }, "image/png")
    })
}

export function generate_pending_html(title: string,extra_information = "") {
    let html = ""
    if (title){
        html = `
            <!DOCTYPE html>
            <html style="background-color: black; height: 100%;">
                <head>
                    <title>
                        Searching for ${title}
                    </title>
                    <meta name="viewport" content="initial-scale=1.0">
                </head>
                <body style="height:100%; width: 100%; background-color: black; color: white; overflow: hidden;">
                    <div style="margin-top: 32px; margin-bottom: 8px; text-align: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" />
                            <path d="M15 15L20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                    <div style="margin-top: 8px; margin-bottom: 8px; font-size: 20px; text-align: center">
                        Searching for
                    </div>
                    <div style="margin-top: 8px; margin-bottom: 8px; font-size: 20px; text-align: center;">
                        ${title}
                    </div>
                    <div style="margin-top: 8px; margin-bottom: 8px; font-size: 20px; text-align: center;">
                        ${extra_information}
                    </div>
                    <div style="margin-top: 8px; margin-bottom: 8px; font-size: 20px; text-align: center;">
                        Please wait for a moment...
                    </div>
                </body>
            </html>`
    }
    return html
}