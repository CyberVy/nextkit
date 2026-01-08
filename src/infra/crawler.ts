import { NestedRecordValue } from "@/infra/types"

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
