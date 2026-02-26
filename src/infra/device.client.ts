export function is_apple_device(){
    if (typeof window === "undefined") {
        return false
    }
    const user_agent = navigator.userAgent.toLowerCase()
    return (user_agent.includes("iphone") || user_agent.includes("ipad") || user_agent.includes("macintosh") || user_agent.includes("applewebkit"))
        && !(user_agent.includes("windows") || user_agent.includes("linux") || user_agent.includes("cros"))
}

export function is_touch_device(){
    if (typeof window === "undefined") {
        return false
    }
    return (("ontouchend" in document) || navigator.maxTouchPoints > 0)
}

export function is_ios_device(){
    return is_apple_device() && is_touch_device()
}

export function is_ios_desktop_device(){
    const user_agent = navigator.userAgent.toLowerCase()
    return user_agent.includes("macintosh") && is_ios_device()
}

export function is_android_device(){
    const user_agent = navigator.userAgent.toLowerCase()
    return user_agent.includes("android") && is_touch_device()
}

export function is_iphone(){
    const user_agent = navigator.userAgent.toLowerCase()
    return user_agent.includes("iphone")
}

export function is_mac(){
    return is_apple_device() && !is_touch_device()
}

export function is_ipad(){
    if (typeof window === "undefined") {
        return false
    }
    const user_agent = navigator.userAgent.toLowerCase()
    const mobile_ua = user_agent.includes("ipad")
    const desk_ua = user_agent.includes("macintosh") && (("ontouchend" in document) || navigator.maxTouchPoints > 0)
    return mobile_ua || desk_ua
}

export function is_in_pwa(){
    if (typeof window === "undefined") {
        return false
    }
    // Chrome can install a non-PWA as a PWA with display-mode: minimal-ui,
    // and this function also regards it as a PWA
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
    )
}

export function is_in_webview(){
    if (typeof window === "undefined") {
        return false
    }
    return Boolean(window.webkit && window.webkit.messageHandlers)
}

export function is_in_native(){
    if (typeof window === "undefined") {
        return false
    }
    return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

export function is_service_worker_available(){
    if (typeof window === "undefined") {
        return false
    }
    return Boolean(navigator.serviceWorker?.controller)
}

export function is_in_background(){
    if (typeof window === "undefined") {
        return false
    }
    return document.visibilityState === "hidden"
}

export function is_viewport_portrait(){
    if (typeof window === "undefined") {
        return false
    }
    const height = document.documentElement.clientHeight
    const width = document.documentElement.clientWidth
    return height > width
}

export function ios_haptic(){
    if (!is_ios_device()) return

    const label_element = document.createElement("label")
    label_element.style.display = "none"
    const input_element = document.createElement("input")
    input_element.type = "checkbox"
    input_element.setAttribute("switch", "")
    label_element.appendChild(input_element)
    document.head.appendChild(label_element)
    try {
        label_element.click()
        document.head.removeChild(label_element)
    }
    catch {}
}

export function vibrate(){
    if (is_ios_device()){
        ios_haptic()
    }
    else if (navigator.vibrate){
        navigator.vibrate(50)
    }
}

// the default dom string is to  avoid flicker on iOS devices
export async function open_url(url: string, target: "_self" | "_blank" ,dom_string = `<body style="background-color: black;"></body>`){
    if (is_in_native()){
        if (target === "_blank"){
            if (is_touch_device()){
                return window.open(url, "_blank","popup")
            }
            else {
                const WebviewWindow = await import('@tauri-apps/api/webviewWindow').then(m => m.WebviewWindow)
                return new WebviewWindow("Extra", {
                    url: url,
                    width: 800,
                    height: 600,
                    x:0,
                    y:0
                })
            }
        }
        // Keep "_self" for flows that intentionally replace the current page.
        else if (target === "_self"){
            return window.open(url, "_self","popup")
        }
        return
    }
    // only support pending document string for the browser environments
    const new_window = window.open("about:blank", target,"popup")
    if (!new_window) return

    new_window.document.documentElement.innerHTML = dom_string
    new_window.location.replace(url)
    return new_window
}
