import type { RefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { is_ios_device } from "@/infra/device.client"
import { LocalStorageMap, LocalForageMap } from "@/infra/storage.client"

/** root_margin: expands or shrinks the viewport area used by IntersectionObserver.
 *
 *  protected_padding: keep the contents which are within the top or bottom 'protected_padding' in view to prevent repeating renders
**/
type UseInViewportOptions = {
    enabled?: boolean
    root?: HTMLElement | null
    root_margin?: number | string
    protected_padding?: number
    threshold?: number | number[]
    initial_in_view?: boolean
}

function get_root_margin(root_margin: number | string){
    if (typeof root_margin === "number") return `${root_margin}px`

    return root_margin
}

export function useInViewport<T extends HTMLElement>({
    enabled = true,
    root,
    root_margin = 0,
    protected_padding = 0,
    threshold = 0,
    initial_in_view = false,
}: UseInViewportOptions = {}){
    const [element, set_element] = useState<T | null>(null)
    const [is_intersecting, set_is_intersecting] = useState(initial_in_view)
    const ref = useCallback((next_element: T | null) => {
        set_element(next_element)
    }, [])

    useEffect(() => {
        if (!element) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const target_element = entry.target as T
                const root_element = root || document.documentElement
                if (protected_padding){
                    if (target_element.offsetTop - root_element.offsetTop <= protected_padding || target_element.offsetTop - root_element.offsetTop >= root_element.scrollHeight - protected_padding){
                        set_is_intersecting(true)
                        return
                    }
                }

                set_is_intersecting(entry.isIntersecting)
            })
        }, { threshold: threshold, rootMargin: get_root_margin(root_margin), root: root || null })
        observer.observe(element)

        return () => observer.disconnect()
    }, [element, protected_padding, root, root_margin, threshold])

    const in_view = enabled && is_intersecting

    return { ref: ref, in_view: in_view }
}

// create an auto sync state and ref object
export function useAutoSyncRefAndState<T>(value: T): [RefObject<T>, (value: T | ((prev: T) => T)) => void, T]{
    const [state, set_state] = useState(value)
    const state_ref = useRef(value)
    const dispatch_func = (value: T | ((prev: T) => T)) => {
        if (typeof value !== "function"){
            set_state(value)
            state_ref.current = value
        }
        else {
            const f = value as (prev: T) => T
            const r = f(state_ref.current)
            set_state(r)
            state_ref.current = r
        }
    }
    return [state_ref, dispatch_func, state]
}

// beta feature
// 1. screen rotation in iOS Safari (PWA and Webkit) may cause a crash when the document height is large
// 2. provide a better rotation animation
export function useOptimizedRotation(){
    const [hidden, set_hidden] = useState(false)

    useEffect(() => {
        if (is_ios_device()){

            const height = document.documentElement.clientHeight
            const width = document.documentElement.clientWidth
            let is_portrait = height > width

            const resize_callback = () => {
                const height_after_resize = document.documentElement.clientHeight
                const width_after_resize = document.documentElement.clientWidth
                const is_portrait_after_resize = height_after_resize > width_after_resize

                // not a rotation action
                if (is_portrait == is_portrait_after_resize)
                    return

                // a rotation action is detected, update the is_portrait state
                is_portrait = !is_portrait
                set_hidden(true)
                setTimeout(() => set_hidden(false), 200)
            }
            window.addEventListener("resize", resize_callback)
            return () => window.removeEventListener("resize", resize_callback)
        }
    }, [])

    return hidden
}
export function useStateWithLocalStorage<T>(init_value: T, key: string, namespace = "hooks"): [T, ((value: (T) | ((prev: T) => T)) => void)]{
    const storage = useMemo(() => new LocalStorageMap<T>(namespace), [namespace])
    const [state, set_state] = useState<T>(init_value)
    const is_string_type = typeof init_value === "string"
    const last_state = useRef<T>(state)

    useEffect(() => {
        const load_value = () => {
            const init_value_from_local_storage = storage.get(key)
            if (init_value_from_local_storage !== undefined){
                set_state(init_value_from_local_storage)
            }
        }
        load_value()
    }, [storage, key, is_string_type])

    useEffect(() => {
        if (state === last_state.current){
            return
        }
        last_state.current = state

        if (state === undefined){
            storage.delete(key)
        }
        else {
            storage.set(key, state)
        }
    }, [key, state, storage])

    return [state, set_state]
}

export function useAutoSyncRefAndStateWithLocalStorage<T>(init_value: T, key: string, namespace = "hooks"): [RefObject<T>, (value: (T) | ((prev: T) => T)) => void, T]{
    const storage = useMemo(() => new LocalStorageMap<T>(namespace), [namespace])
    const [state, set_state] = useState<T>(init_value)
    const state_ref = useRef<T>(state)
    const is_string_type = typeof init_value === "string"
    const last_state = useRef<T>(state)

    const dispatch_func = useCallback((value: (T) | ((prev: T) => T)) => {
        if (typeof value !== "function"){
            set_state(value)
            state_ref.current = value
        } 
        else {
            const f = value as (prev: T) => T
            const r = f(state_ref.current)
            set_state(r)
            state_ref.current = r
        }
    }, [])

    useEffect(() => {
        const load_value = () => {
            const init_value_from_local_storage = storage.get(key)
            if (init_value_from_local_storage !== undefined){
                set_state(init_value_from_local_storage)
                state_ref.current = init_value_from_local_storage
            }
        }
        load_value()
    }, [storage, key, is_string_type])

    useEffect(() => {
        if (state === last_state.current){
            return
        }
        last_state.current = state

        if (state === undefined){
            storage.delete(key)
        } 
        else {
            storage.set(key, state)
        }
    }, [key, state, storage])

    return [state_ref, dispatch_func, state]
}

export function useStateWithLocalForage<T>(init_value: T, key: string, store_name = "keyval"): [T, ((value: (T) | ((prev: T) => T)) => void)]{
    const [state, set_state] = useState<T>(init_value)
    const storage = useMemo(() => new LocalForageMap<T>(store_name), [store_name])
    const is_string_type = typeof init_value === "string"
    const is_initialized = useRef(false)
    const user_has_set_state = useRef(false)

    useEffect(() => {
        let active = true
        is_initialized.current = false
        user_has_set_state.current = false

        const load_value = async () => {
            const init_value_from_storage = await storage.get(key)

            if (!active) return

            if (!user_has_set_state.current){
                if (init_value_from_storage !== undefined){
                    set_state(init_value_from_storage)
                }
                is_initialized.current = true
            }
        }
        load_value()

        return () => {
            active = false
        }
    }, [key, storage, is_string_type])

    const set_state_wrapped = useCallback((value: (T) | ((prev: T) => T)) => {
        user_has_set_state.current = true
        is_initialized.current = true
        set_state(value)
    }, [])

    useEffect(() => {
        if (!is_initialized.current) return

        if (state === undefined){
            storage.delete(key)
        }
        else {
            storage.set(key, state)
        }
    }, [key, state, storage])

    return [state, set_state_wrapped]
}

export function useAutoSyncRefAndStateWithLocalForage<T>(init_value: T, key: string, store_name = "keyval"): [RefObject<T>, (value: (T) | ((prev: T) => T)) => void, T]{
    const [state, set_state] = useState<T>(init_value)
    const state_ref = useRef<T>(init_value)
    const storage = useMemo(() => new LocalForageMap<T>(store_name), [store_name])
    const is_string_type = typeof init_value === "string"
    const is_initialized = useRef(false)
    const user_has_set_state = useRef(false)

    const dispatch_func = useCallback((value: (T) | ((prev: T) => T)) => {
        user_has_set_state.current = true
        is_initialized.current = true
        if (typeof value !== "function"){
            set_state(value)
            state_ref.current = value
        } 
        else {
            const f = value as (prev: T) => T
            const r = f(state_ref.current)
            set_state(r)
            state_ref.current = r
        }
    }, [])

    useEffect(() => {
        let active = true
        is_initialized.current = false
        user_has_set_state.current = false

        const load_value = async () => {
            const init_value_from_storage = await storage.get(key)

            if (!active) return

            if (!user_has_set_state.current){
                if (init_value_from_storage !== undefined){
                    set_state(init_value_from_storage)
                    state_ref.current = init_value_from_storage
                }
                is_initialized.current = true
            }
        }
        load_value()

        return () => {
            active = false
        }
    }, [key, storage, is_string_type])

    useEffect(() => {
        if (!is_initialized.current) return

        if (state === undefined){
            storage.delete(key)
        } 
        else {
            storage.set(key, state)
        }
    }, [key, state, storage])

    return [state_ref, dispatch_func, state]
}
