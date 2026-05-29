const rpc_cache: Record<string, unknown> = {}

function get_object_from_underscore_key(segment: string): unknown{
    if (segment.startsWith("__") && segment.endsWith("__")){
        return rpc_cache[segment.slice(2, -2)]
    }
    return null
}

function get_object_from_path(path: string): { this_arg: any, target: any }{
    const parts = path.split(".")
    const cached = get_object_from_underscore_key(parts[0])

    let this_arg: any = undefined
    let current: any = cached !== null ? cached : window
    if (cached !== null){
        parts.shift()
    }

    for (const part of parts){
        this_arg = current
        current = current[part]
    }
    return { this_arg, target: current }
}

function resolve_string_or_cached_by_key(value: unknown): unknown{
    if (typeof value === "string"){
        const cached = get_object_from_underscore_key(value)
        if (cached !== null) return cached
    }
    return value
}

function execute(path: string, args: unknown[], name?: string){
    const { this_arg, target } = get_object_from_path(path)
    const _args = args.map(resolve_string_or_cached_by_key)
    const r = target.call(this_arg, ..._args)
    if (name) rpc_cache[name] = r
}

function assign(path: string, value: unknown){
    const parts = path.split(".")
    const key = parts[parts.length - 1]

    let obj: any

    if (parts.length === 1){
        const cached = get_object_from_underscore_key(parts[0])
        if (cached !== null){
            rpc_cache[parts[0].slice(2, -2)] = resolve_string_or_cached_by_key(value)
            return
        }
        obj = window
    } 
    else {
        const parent_path = parts.slice(0, -1).join(".")
        const { target: parent } = get_object_from_path(parent_path)
        obj = parent
    }

    obj[key] = resolve_string_or_cached_by_key(value)
}

// Usages:
// w = window.open("http://104.16.0.0")
// Register_rpc in http://104.16.0.0
// w.postMessage({func:"rpc_execute",args:["console.log",["1","2","3"]]},"*")
// w.postMessage({func:"rpc_assign",args:["__test__",2]},"*")
export function register_web_message_rpc(){
    const callback = (event: MessageEvent) => {
        let data: {func?: string, args?: unknown[]} = {}
        if (typeof event.data === "string"){
            try {
                data = JSON.parse(event.data)
            }
            catch {
                return
            }
        }
        else {
            data = event.data
        }
        const args = data.args
        if (data.func === "rpc_execute"){
            if (args){
                execute(...args as [string, unknown[], string | undefined])
            }
        }
        else if (data.func === "rpc_assign"){
            if (args){
                assign(...args as [string, unknown])
            }
        }
    }
    window.addEventListener("message", callback)
}
