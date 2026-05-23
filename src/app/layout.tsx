import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { description, title } from "../../package.json"
import type { ReactNode } from "react"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
})

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    title: title,
    description: description,
    openGraph: {
        title: title,
        description: description,
    },
    manifest: "/manifest.json",
    icons: {
        apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent"
    }
}

export const viewport: Viewport = {
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: dark)", color: "#000000" },
        { media: "(prefers-color-scheme: light)", color: "#FFFFFF" }
    ],
    userScalable: false
}

// This css aims to avoid launch flicker in light mode on some platforms (e.g. iOS PWA).
const no_flicker_background_css = `
    html {
        background: #FFFFFF;
    }

    @media (prefers-color-scheme: dark) {
        html {
            background: #000000;
        }
    }`

export default function RootLayout({ children }: Readonly<{children: ReactNode}>){
    return (
        <html lang="en">
            <head>
                <style>
                    {no_flicker_background_css}
                </style>
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    )
}
