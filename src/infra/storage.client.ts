import localforage from "localforage"

export class LocalForageMap<V>{
    private lf_instance: LocalForage

    constructor(store_name = "keyval", db_name = "localforage"){
        this.lf_instance = localforage.createInstance({
            name: db_name,
            storeName: store_name
        })
    }

    public async get(key: string): Promise<V | undefined>{
        const val = await this.lf_instance.getItem<V>(key)
        return val === null ? undefined : val
    }

    public async set(key: string, value: V): Promise<this>{
        await this.lf_instance.setItem(key, value)
        return this
    }

    public async has(key: string): Promise<boolean>{
        const keys = await this.lf_instance.keys()
        return keys.includes(key)
    }

    public async delete(key: string): Promise<boolean>{
        const exists = await this.has(key)
        if (exists){
            await this.lf_instance.removeItem(key)
            return true
        }
        return false
    }

    public async clear(): Promise<void>{
        await this.lf_instance.clear()
    }

    public async size(): Promise<number>{
        return await this.lf_instance.length()
    }

    public async keys(): Promise<string[]>{
        return await this.lf_instance.keys()
    }
}

export class LocalStorageMap<V>{
    private namespace: string

    constructor(namespace: string){
        this.namespace = namespace
    }

    private get_full_key(key: string): string{
        return `${this.namespace}:${key}`
    }

    public get(key: string): V | undefined{
        const val = localStorage.getItem(this.get_full_key(key))
        if (val === null) return undefined
        try {
            return JSON.parse(val) as V
        }
        catch {
            return val as unknown as V
        }
    }

    public set(key: string, value: V): this{
        const val_str = typeof value === "string" ? value : JSON.stringify(value)
        localStorage.setItem(this.get_full_key(key), val_str as string)
        return this
    }

    public has(key: string): boolean{
        return localStorage.getItem(this.get_full_key(key)) !== null
    }

    public delete(key: string): boolean{
        const full_key = this.get_full_key(key)
        if (localStorage.getItem(full_key) !== null){
            localStorage.removeItem(full_key)
            return true
        }
        return false
    }

    public clear(): void{
        const prefix = `${this.namespace}:`
        const keys_to_remove: string[] = []
        for (let i = 0; i < localStorage.length; i++){
            const key = localStorage.key(i)
            if (key?.startsWith(prefix)){
                keys_to_remove.push(key)
            }
        }
        keys_to_remove.forEach(key => localStorage.removeItem(key))
    }

    public keys(): string[]{
        const prefix = `${this.namespace}:`
        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++){
            const key = localStorage.key(i)
            if (key?.startsWith(prefix)){
                keys.push(key.slice(prefix.length))
            }
        }
        return keys
    }
}

export class CacheStorageMap{
    private cache_name: string
    private cache_storage: Cache | null = null
    private ready_promise: Promise<void>

    constructor(name: string){
        this.cache_name = name
        this.ready_promise = this.init_cache()
    }

    private async init_cache(): Promise<void>{
        try {
            this.cache_storage = await caches.open(this.cache_name)
        }
        catch (e){
            console.error(`Failed to open CacheStorage ${this.cache_name}:`, e)
        }
    }

    private async wait_until_ready(): Promise<Cache>{
        await this.ready_promise
        if (!this.cache_storage){
            throw new Error(`CacheStorage ${this.cache_name} is not initialized.`)
        }
        return this.cache_storage
    }

    public async get(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined>{
        const cache = await this.wait_until_ready()
        return await cache.match(request, options)
    }

    public async set(request: RequestInfo | URL, response: Response): Promise<this>{
        const cache = await this.wait_until_ready()
        await cache.put(request, response)
        return this
    }

    public async has(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>{
        const cached = await this.get(request, options)
        return cached !== undefined
    }

    public async delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>{
        const cache = await this.wait_until_ready()
        return await cache.delete(request, options)
    }

    public async clear(): Promise<void>{
        await this.ready_promise
        await caches.delete(this.cache_name)
        this.ready_promise = this.init_cache()
        await this.ready_promise
    }

    public async size(): Promise<number>{
        const keys = await this.keys()
        return keys.length
    }

    public async keys(): Promise<readonly Request[]>{
        const cache = await this.wait_until_ready()
        return await cache.keys()
    }
}
