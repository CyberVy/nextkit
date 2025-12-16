import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import React from "react"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
})

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    title: "NextKit",
    description: "Create app on NextKit",
    openGraph: {
        title: "NextKit",
        description: "Create app on NextKit"
    },
    manifest: "/manifest.json",
    icons: {
        apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    )
}
