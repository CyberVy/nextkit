import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    reactStrictMode: false,
    reactCompiler: true,
    output: "export",
    env: {
        NEXT_PUBLIC_BUILD_TIME: new Date().toUTCString(),
        NEXT_PUBLIC_NATIVE_ENTRY_URL: "/"
    }
}

export default nextConfig
