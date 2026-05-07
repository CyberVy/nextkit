export function join_classes(...classes: (string | false | null | undefined)[]){
    return classes.filter(Boolean).join(" ")
}
