import { handle_web_rpc_request, web_rpc_request } from "@/infra/web_rpc.client"

export type RemoteProxy<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? (...args: A) => RemoteProxy<R>
        : RemoteProxy<T[K]>
} & {
    $execute(): Promise<any>
    $set(value: any): Promise<any>
}

export function remote(targetWindow: Window): any
export function remote<T>(targetWindow: Window): RemoteProxy<T>
export function remote(targetWindow: Window): any{
    const steps: any[] = []

    const createProxy = (path: string[]): any => {
        return new Proxy(() => {}, {
            get(target, prop: string){
                if (prop === "$execute"){
                    return () => web_rpc_request({
                        target: targetWindow,
                        type: "rpc_chain",
                        payload: { steps }
                    })
                }
                if (prop === "$set"){
                    return (value: any) => {
                        steps.push({ op: "set", value })
                        return web_rpc_request({
                            target: targetWindow,
                            type: "rpc_chain",
                            payload: { steps }
                        })
                    }
                }

                steps.push({ op: "get", name: prop })
                return createProxy([...path, prop])
            },
            apply(target, thisArg, argList){
                steps.push({ op: "call", args: argList })
                return createProxy(path)
            }
        })
    }

    return createProxy([])
}

export function register_dynamic_rpc(){
    handle_web_rpc_request({
        type: "rpc_chain",
        handler: async (payload) => {
            const { steps } = payload as { steps: any[] }
            let current: any = window
            let parent: any = undefined
            let last_prop_name = ""

            for (const step of steps){
                if (step.op === "get"){
                    parent = current
                    last_prop_name = step.name
                    current = current[step.name]
                } 
                else if (step.op === "call"){
                    if (typeof current !== "function"){
                        throw new Error(`Property "${last_prop_name}" is not a function`)
                    }
                    current = current.apply(parent, step.args)
                } 
                else if (step.op === "set"){
                    if (parent === undefined || parent === null){
                        throw new Error("No parent context to set value")
                    }
                    parent[last_prop_name] = step.value
                    current = step.value
                }
            }
            return current
        }
    })
}

export function notify_rpc_success_to_window(_window: Window){
    web_rpc_request({
        target: _window,
        type: "register_web_message_rpc",
        payload: { result: "success", origin: location.href }
    }).catch(err => console.warn(err))
}
