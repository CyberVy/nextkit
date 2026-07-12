import localforage from "localforage"
import { migration_promise } from "@/core/storage_migration"

export class LocalForageItemController<T = string>{
    public name: string
    private static is_configured = false

    constructor(name: string){
        this.name = name
        if (!LocalForageItemController.is_configured){
            localforage.config({
                name: "localForage",
                storeName: "keyval"
            })
            LocalForageItemController.is_configured = true
        }
    }

    public async get_item(): Promise<string | null>{
        await migration_promise
        return await localforage.getItem<string>(this.name)
    }

    public async set_item(value: string): Promise<void>{
        await migration_promise
        await localforage.setItem(this.name, value)
    }

    public async remove_item(): Promise<void>{
        await migration_promise
        await localforage.removeItem(this.name)
    }

    public get value_item(): Promise<string | null>{
        return this.get_item()
    }

    public async get_object(): Promise<T | null>{
        const value = await this.get_item()
        if (value !== null){
            try {
                return JSON.parse(value) as T
            }
            catch (e){
                console.error(`Failed to parse LocalForage item ${this.name}:`, e)
                return null
            }
        }
        return null
    }

    public async set_object(value_object: T): Promise<void>{
        const value = JSON.stringify(value_object)
        await this.set_item(value)
    }

    public async remove_object(): Promise<void>{
        await this.remove_item()
    }

    public get value_object(): Promise<T | null>{
        return this.get_object()
    }

    public async get(type: "object"): Promise<T | null>
    public async get(type: "string"): Promise<string | null>
    public async get(type: "object" | "string"){
        if (type === "object"){
            return this.value_object
        }
        else if (type === "string"){
            return this.value_item
        }
    }
}

export class LocalStorageItemController<T = string>{
    public name: string

    constructor(name: string){
        this.name = name
    }

    public get_item(): string | null{
        return localStorage.getItem(this.name)
    }

    public set_item(value: string): void{
        return localStorage.setItem(this.name, value)
    }

    public remove_item(): void{
        return localStorage.removeItem(this.name)
    }

    public get value_item(): string | null{
        return this.get_item()
    }

    public get_object(): T | null{
        const value = this.value_item
        if (value !== null){
            try {
                return JSON.parse(value) as T
            }
            catch (e){
                console.error(`Failed to parse LocalStorage item ${this.name}:`, e)
                return null
            }
        }
        else {
            return null
        }
    }

    public set_object(value_object: T){
        const value = JSON.stringify(value_object)
        this.set_item(value)
    }

    public remove_object(): void{
        return this.remove_item()
    }

    public get value_object(): T | null{
        return this.get_object()
    }

    public get(type: "object"): T | null
    public get(type: "string"): string | null
    public get(type: "object" | "string"){
        if (type === "object"){
            return this.value_object
        }
        else if (type === "string"){
            return this.value_item
        }
    }
}

export class CacheStorageItemController{
    public cache_storage_name: string
    public cache_storage: Cache | null
    private ready_promise: Promise<void>

    constructor(name: string){
        this.cache_storage_name = name
        this.cache_storage = null

        console.log(`CacheStorageItemController: ${name} initializing...`)
        this.ready_promise = this.get_cache_storage().then(() => {
            console.log(`CacheStorageItemController: ${name} initialized.`)
        })
    }

    public async get_cache_storage(){
        try {
            const cache_storage = await caches.open(this.cache_storage_name)
            this.cache_storage = cache_storage
        }
        catch (err){
            console.error(err)
        }
    }

    public async wait_until_ready(){
        await this.ready_promise
    }

    public get is_ready(){
        return this.cache_storage !== null
    }

    public async get(request: RequestInfo | URL, options?: CacheQueryOptions){
        await this.wait_until_ready()
        if (!this.cache_storage) return
        return await this.cache_storage.match(request, options)
    }

    public async set(request: RequestInfo | URL, response: Response){
        await this.wait_until_ready()
        if (!this.cache_storage) return
        return await this.cache_storage.put(request, response)
    }

    public async delete(request: RequestInfo | URL, options?: CacheQueryOptions){
        await this.wait_until_ready()
        if (!this.cache_storage) return
        return await this.cache_storage.delete(request, options)
    }

    public async get_keys(){
        await this.wait_until_ready()
        if (!this.cache_storage) return
        return this.cache_storage.keys()
    }

    public get keys(){
        return this.get_keys()
    }

    public async destroy(){
        return await caches.delete(this.cache_storage_name).then(r => {
            if (r){
                console.log(`Destroyed cache storage: ${this.cache_storage_name}`)
            } 
            else {
                console.log(`Failed to destroy cache storage: ${this.cache_storage_name}`)
            }
        })
    }
}
