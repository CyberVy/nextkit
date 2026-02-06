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
    if (typeof input === "string"){
        url = input
    }
    else if(input instanceof URL){
        url = input.href
    }
    else if (input instanceof Request){
        url = input.url
    }

    if (is_in_native() && !cors_proxy){
        // now only support "Get" method
        return await invoke("fetch",{req: {url: url}}) as {body:string, headers:object, status:number}
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