export interface ViewSwitcherState {
    id: string
    is_toolbar_visible: boolean
    is_transitioning: boolean
    active_view_id: string
    target_view_id: string | null
}

export type ViewSwitcherListener = (state: ViewSwitcherState) => void

export interface SetToolbarVisibleOptions {
    wait_until_stable?: boolean
}

export class ViewSwitcherController{
    private states = new Map<string, ViewSwitcherState>()
    private listeners = new Map<string, Set<ViewSwitcherListener>>()
    private global_hide_count = 0
    private pending_visibilities = new Map<string, boolean>()

    public register(id: string, initial_state: ViewSwitcherState, listener: ViewSwitcherListener): () => void{
        const existing = this.states.get(id)
        if (existing){
            this.states.set(id, {
                ...initial_state,
                is_toolbar_visible: existing.is_toolbar_visible
            })
        }
        else {
            this.states.set(id, initial_state)
        }

        if (!this.listeners.has(id)){
            this.listeners.set(id, new Set())
        }
        this.listeners.get(id)!.add(listener)

        listener(this.get_effective_state(id)!)

        return () => {
            const list = this.listeners.get(id)
            if (list){
                list.delete(listener)
                if (list.size === 0){
                    this.listeners.delete(id)
                    this.states.delete(id)
                }
            }
        }
    }

    private get_effective_state(id: string): ViewSwitcherState | undefined{
        const state = this.states.get(id)
        if (!state) return undefined
        return {
            ...state,
            is_toolbar_visible: this.global_hide_count > 0 ? false : state.is_toolbar_visible
        }
    }

    public update_state(id: string, updates: Partial<Omit<ViewSwitcherState, "id" | "is_toolbar_visible">>){
        const current = this.states.get(id)
        if (!current) return

        let changed = false
        let is_transitioning_changed = false
        const updated: ViewSwitcherState = { ...current }

        if (updates.is_transitioning !== undefined && updates.is_transitioning !== current.is_transitioning){
            updated.is_transitioning = updates.is_transitioning
            is_transitioning_changed = true
            changed = true
        }

        if (updates.active_view_id !== undefined && updates.active_view_id !== current.active_view_id){
            updated.active_view_id = updates.active_view_id
            changed = true
        }

        if (updates.target_view_id !== undefined && updates.target_view_id !== current.target_view_id){
            updated.target_view_id = updates.target_view_id
            changed = true
        }

        if (changed){
            if (updates.is_transitioning === false && this.pending_visibilities.has(id)){
                const pending_visible = this.pending_visibilities.get(id)!
                this.pending_visibilities.delete(id)
                if (updated.is_toolbar_visible !== pending_visible){
                    updated.is_toolbar_visible = pending_visible
                }
            }

            this.states.set(id, updated)
            if (is_transitioning_changed){
                this.notify_all()
            }
            else {
                this.notify(id)
            }
        }
    }

    public set_toolbar_visible(id: string, visible: boolean, options?: SetToolbarVisibleOptions){
        const current = this.states.get(id)
        
        const wait_until_stable = options?.wait_until_stable ?? false
        
        if (wait_until_stable && current?.is_transitioning){
            this.pending_visibilities.set(id, visible)
            return
        }

        this.pending_visibilities.delete(id)

        if (current){
            if (current.is_toolbar_visible !== visible){
                current.is_toolbar_visible = visible
                this.notify(id)
            }
        }
        else {
            this.states.set(id, {
                id,
                is_toolbar_visible: visible,
                is_transitioning: false,
                active_view_id: "",
                target_view_id: null
            })
        }
    }

    public show_toolbar(id: string, options?: SetToolbarVisibleOptions){
        this.set_toolbar_visible(id, true, options)
    }

    public hide_toolbar(id: string, options?: SetToolbarVisibleOptions){
        this.set_toolbar_visible(id, false, options)
    }

    public hide_all_toolbars(){
        this.global_hide_count++
        if (this.global_hide_count === 1){
            this.notify_all()
        }
    }

    public show_all_toolbars(){
        this.global_hide_count = Math.max(0, this.global_hide_count - 1)
        if (this.global_hide_count === 0){
            this.notify_all()
        }
    }

    get_state(id: string): ViewSwitcherState | undefined{
        return this.states.get(id)
    }

    /**
     * Checks if any registered ViewSwitcher instance (excluding optional exclude_id) is currently transitioning.
     *
     * CSS CONTAINING BLOCK ARCHITECTURAL NOTE:
     * When a ViewSwitcher undergoes horizontal swipe transitions, its active/target view container
     * is set to `position: fixed` with a `transform: translate3d(...)` property. According to CSS Specs,
     * any element with a non-none `transform` becomes the Containing Block for its nested `position: fixed` descendants.
     *
     * If a nested/child ViewSwitcher initiates a transition while a parent/ancestor ViewSwitcher is still transitioning,
     * the child's `fixed` positioning target shifts from the Viewport to the parent's container, causing vertical
     * position offset calculation errors and visual flickering.
     *
     * This method acts as a cross-instance transition lock to prevent overlapping transition animations.
     */
    public has_any_transitioning(exclude_id?: string): boolean{
        for (const [id, state] of this.states.entries()){
            if (id !== exclude_id && state.is_transitioning){
                return true
            }
        }
        return false
    }

    private notify(id: string){
        const effective = this.get_effective_state(id)
        const list = this.listeners.get(id)
        if (effective && list){
            list.forEach((listener) => {
                try {
                    listener(effective)
                }
                catch (e){
                    console.error("Error in ViewSwitcher listener:", e)
                }
            })
        }
    }

    private notify_all(){
        for (const id of this.states.keys()){
            this.notify(id)
        }
    }
}

export const view_switcher_controller = new ViewSwitcherController()
