import type { Range } from "./compiler"
import type { Destruction } from "./runtime"
import type { TemplateNode } from "./compiler"

export interface ExpectedEffect {
    cleaner: any
    timing: number
    destroyed: boolean
    dependencies: any[]
    destruction: Destruction | null
}

export interface CompileErrorMatcher {
    range: Range
    msg: string | RegExp
}

export interface ExpectedCompileMessage {
    value: string
    range: Range
    type: "error" | "warning"
}

export type ExpectedTemplateNode = Omit<Partial<TemplateNode>, "children"> & {
    children?: ExpectedTemplateNode[]
}
