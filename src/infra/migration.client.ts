import { is_ios_device, is_android_device } from "./device.client"
import localforage from "localforage"

export interface BackupPackage {
    metadata: {
        app: string
        version: string
        exported_at: string
    }
    payload: Record<string, any>
}

export interface ImportOptions {
    mode: "overwrite" | "merge"
    merge_rules?: Record<string, { identity_key: string | string[] }>
}

export class MigrationService{

    public static async generate_backup_data(
        app_id: string,
        app_version: string,
        local_keys?: string[]
    ): Promise<string>{
        const payload: Record<string, any> = {}

        if (typeof window !== "undefined"){
            const keys = local_keys || await localforage.keys()
            for (const key of keys){
                const val = await localforage.getItem<string>(key)
                if (val !== null){
                    try {
                        payload[key] = JSON.parse(val)
                    }
                    catch {
                        payload[key] = val
                    }
                }
            }
        }

        const backup_package: BackupPackage = {
            metadata: {
                app: app_id,
                version: app_version,
                exported_at: new Date().toISOString()
            },
            payload
        }

        return JSON.stringify(backup_package, null, 2)
    }

    /**
     * Parse package and automatically perform deduplicated merge or overwrite onto localStorage
     */
    public static async restore_from_backup_data(
        json_str: string,
        expected_app_id: string,
        options: ImportOptions
    ): Promise<{ success: boolean; error?: string }>{
        try {
            const backup_package = JSON.parse(json_str) as BackupPackage

            // 1. Basic validation
            if (!backup_package.metadata || backup_package.metadata.app !== expected_app_id){
                return { success: false, error: "Invalid backup file: Application identifier mismatch" }
            }

            const payload = backup_package.payload
            if (!payload || typeof payload !== "object"){
                return { success: false, error: "Invalid backup file: Missing payload" }
            }

            const { mode, merge_rules = {} } = options

            // 2. Write or Merge keys
            for (const key of Object.keys(payload)){
                const val = payload[key]

                // 2.1 Merge list mode
                if (mode === "merge" && merge_rules[key] && Array.isArray(val)){
                    const rule = merge_rules[key]
                    const current_str = await localforage.getItem<string>(key)
                    let current: any[] = []
                    if (current_str !== null){
                        try {
                            const parsed = JSON.parse(current_str)
                            if (Array.isArray(parsed)){
                                current = parsed
                            }
                        }
                        catch (e){
                            console.error(`Failed to parse current key "${key}" for merging:`, e)
                        }
                    }

                    const merged = [...current]

                    for (const item of val){
                        const is_duplicate = merged.some(x => {
                            if (Array.isArray(rule.identity_key)){
                                return rule.identity_key.every(k => x[k] === item[k])
                            } 
                            else {
                                if (typeof item !== "object" || item === null){
                                    return x === item
                                }
                                const item_k = item[rule.identity_key]
                                const x_k = x[rule.identity_key]
                                if (item_k !== undefined){
                                    return x_k === item_k
                                }
                                const item_id = item.id || item.video_id
                                const x_id = x.id || x.video_id
                                if (item_id !== undefined){
                                    return x_id === item_id
                                }
                                return false
                            }
                        })

                        if (!is_duplicate){
                            merged.push(item)
                        }
                    }

                    await localforage.setItem(key, JSON.stringify(merged))
                    continue
                }

                // 2.2 Overwrite mode (or non-list keys)
                const val_str = typeof val === "string" ? val : JSON.stringify(val)
                await localforage.setItem(key, val_str)
            }

            return { success: true }
        }
        catch (e){
            console.error("Failed to restore backup:", e)
            return { success: false, error: e instanceof Error ? e.message : String(e) }
        }
    }

    public static async export_file(
        app_id: string,
        app_version: string,
        local_keys?: string[]
    ): Promise<{ success: boolean, method?: "picker" | "share" | "download", error?: string }>{
        try {
            const backup_json = await this.generate_backup_data(app_id, app_version, local_keys)
            const filename = `${app_id}_backup_${new Date().toISOString().slice(0, 10)}.json`

            const is_mobile = is_ios_device() || is_android_device()

            if (is_mobile){
                // Mobile route: Web Share API (native share sheet)
                const blob = new Blob([backup_json], { type: "application/json" })
                if (navigator.share){
                    try {
                        const file = new File([blob], filename, { type: "application/json" })
                        if (navigator.canShare({ files: [file] })){
                            await navigator.share({
                                files: [file]
                            })
                            return { success: true, method: "share" }
                        }
                    }
                    catch (share_err){
                        if (share_err instanceof Error && share_err.name === "AbortError"){
                            return { success: false }
                        }
                        console.warn("navigator.share failed, trying clipboard/download fallbacks:", share_err)
                    }
                }
            }
            else {
                // Desktop route: File System Access API (showSaveFilePicker)
                if (window.showSaveFilePicker){
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{
                                description: "JSON Files",
                                accept: {
                                    "application/json": [".json"],
                                },
                            }],
                        })
                        const writable = await handle.createWritable()
                        await writable.write(backup_json)
                        await writable.close()
                        return { success: true, method: "picker" }
                    }
                    catch (picker_err){
                        if (picker_err instanceof Error && picker_err.name === "AbortError"){
                            return { success: false }
                        }
                        console.warn("showSaveFilePicker failed, trying clipboard/download fallbacks:", picker_err)
                    }
                }
            }

            const blob = new Blob([backup_json], { type: "application/json" })

            // Anchor download fallback
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            return { success: true, method: "download" }
        }
        catch (err){
            console.error("Export file failed:", err)
            return { success: false, error: err instanceof Error ? err.message : String(err) }
        }
    }

    public static async read_file(): Promise<string | null>{
        return new Promise((resolve) => {
            const input = document.createElement("input")
            input.type = "file"
            input.accept = ".json"
            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file){
                    resolve(null)
                    return
                }
                const reader = new FileReader()
                reader.onload = (event) => {
                    resolve(event.target?.result as string || null)
                }
                reader.onerror = () => resolve(null)
                reader.readAsText(file)
            }
            input.click()
        })
    }
}
