export type CoverImageOptions = {
    width?: number
    height?: number
    background?: string
    color?: string
    fontSize?: number
    fontFamily?: string
}
export type NestedRecordValue<T> = NestedRecord<T> | T | NestedRecordValue<T>[]
export interface NestedRecord<T> {
    [key: string]: NestedRecordValue<T>
}
