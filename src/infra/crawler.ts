import { NestedRecordValue } from "@/infra/types"
import { is_in_native } from "@/infra/device.client"
import { invoke } from "@tauri-apps/api/core"

export function scan_record_object<T>(node: NestedRecordValue<T>, target_key?:string): NestedRecordValue<T>[] {
    const r: NestedRecordValue<T>[]  = []
    function visit(node: NestedRecordValue<T>){

        const node_record = node as Record<string, NestedRecordValue<T>>
        for (const key in node_record){

            const node_item = node_record[key]
            if (target_key && target_key === key){
                r.push(node_item)
            }

            if (typeof node_item === "string" || typeof node_item === "number"){
                // console.log("value",key,node_item)
            }
            else if (typeof node_item === "object"){
                // console.log("node",key,node_item)
                visit(node_item)
            }
        }
    }
    visit(node)
    return r
}

export async function smart_fetch(input : string | URL | Request,init?: RequestInit, cors_proxy = ""){

    let url: string = ""
    let headers: Headers = new Headers()
    let request_method: string = "GET"
    if (typeof input === "string"){
        url = input
        headers = new Headers(init?.headers)
        request_method = init?.method || "GET"
    }
    else if(input instanceof URL){
        url = input.href
        headers = new Headers(init?.headers)
        request_method = init?.method || "GET"
    }
    else if (input instanceof Request){
        url = input.url
        headers = new Headers(input.headers)
        request_method = input.method
    }

    if (!headers.get("user-agent")){
        headers.set("user-agent", navigator.userAgent)
    }

    const headers_record: Record<string,string | number> = {}
    headers.forEach((v,k) => {
        headers_record[k] = v
    })


    if (is_in_native() && !cors_proxy){
        return await invoke("fetch",{req: {url: url,headers:headers_record,method:request_method}}) as {body:string, headers:HeadersInit, status:number}
    }
    else {

        if (typeof window !== "undefined"){
            if (init){
                init.credentials = "include"
            }
            else {
                init = new Request(url,{credentials: "include"})
            }
            return await fetch(`${cors_proxy}${url}`, init)
        }
        else {
            return await fetch(url, init)
        }
    }
}
