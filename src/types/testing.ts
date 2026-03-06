import type { Destruction } from "#type-declarations/runtime"
import type { TemplateNode, Range, IdentifierStatus } from "#type-declarations/compiler"

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
