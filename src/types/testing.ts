import type {
    Range,
    TemplateNode,
    CompileOptions,
    IdentifierStatus
} from "#type-declarations/compiler"
import type { Destruction } from "#type-declarations/runtime"

export interface E2EScenario {
    name: string
    title: string
    input: string

    readySelector?: string
    compileOptions?: CompileOptions
    components?: Record<string, string>
}

export interface ExpectedEffect {
    cleaner: any
    timing: number
    destroyed: boolean
    dependencies: any[]
    destruction: Destruction | null
}

export interface E2EWorkerFixtures {
    serverOrigin: string
}

export interface E2EProjectMetadata {
    compileMode: E2ECompileMode
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

export interface ProcessEnvHost {
    process?: {
        env?: Record<string, string | undefined>
    }
}

export interface E2EFixtures {
    visitScenario: (name: string) => Promise<void>
}

export type E2ECompileMode = "debug" | "non-debug"

export type ExpectedTemplateNode = Omit<Partial<TemplateNode>, "children"> & {
    children?: ExpectedTemplateNode[]
}
