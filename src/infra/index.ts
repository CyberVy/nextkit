// crawler.ts
export { scan_record_object, smart_fetch } from "./crawler"

// data_generation_lib.ts
export { generate_silent_wav_base64, generate_cover_image, generate_pending_html } from "./data_generation_lib"

// device.client.ts
export { 
    is_apple_device, is_touch_device, is_ios_device, is_ios_desktop_device, is_android_device, 
    is_iphone, is_mac, is_ipad, is_in_pwa, is_in_webview, is_in_native, is_in_browser, 
    is_service_worker_available, is_in_background, is_viewport_portrait, is_in_dark, 
    ios_haptic, vibrate, open_url 
} from "./device.client"

// filter.ts
export { are_arrays_strictly_equal, are_arrays_content_equal } from "./filter"

// gestures.client.ts
export { create_press_gesture } from "./gestures.client"
export type { PressCancelReason } from "./gestures.client"

// keep_alive.client.ts
export { keep_alive_for_once, auto_keep_alive_by_video_states } from "./keep_alive.client"

// storage.client.ts
export { LocalStorageItemController, CacheStorageItemController } from "./storage.client"

// version.ts
export { static_resource_cache_name, is_later_version, update } from "./version"
export { default as version } from "./version"

// window_hub.client.ts
export { register } from "./window_hub.client"

// window_hub.types.ts
export type { WindowHubSendOptions, WindowHubMessageHandler, WindowHubMessenger, WindowHubIncomingEnvelope } from "./window_hub.types"

// migration.client.ts
export { MigrationService } from "./migration.client"
