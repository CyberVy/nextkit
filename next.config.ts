import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    reactStrictMode: false,
    output: "export",
    env: {
        NEXT_PUBLIC_BUILD_TIME: new Date().toUTCString()
    }
}

export default nextConfig
