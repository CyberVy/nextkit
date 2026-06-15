export function join_classes(...classes: (string | false | null | undefined)[]){
    return classes.filter(Boolean).join(" ")
}

/**
 * Checks if a DOM element is currently hidden via display: none (directly or via an ancestor).
 * When hidden, offsetWidth and offsetHeight are both 0.
 */
export function is_element_hidden(element: HTMLElement | null): boolean{
    if (!element) return true
    return element.offsetWidth === 0 && element.offsetHeight === 0
}

