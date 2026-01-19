import type { Destruction } from "./runtime"
import type { TemplateNode } from "./compiler"
import type { Range, IdentifierStatus } from "./compiler"

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

export interface ExpectedTopLevelIdentifier {
    name: string
    hoist: boolean
    implicit: boolean
    status: IdentifierStatus
}

export type ExpectedTemplateNode = Omit<Partial<TemplateNode>, "children"> & {
    children?: ExpectedTemplateNode[]
}
