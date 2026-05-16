import type {
    Range,
    TemplateNode,
    CompileOptions,
    IdentifierStatus
} from "#type-declarations/compiler"
import type { Destruction } from "#type-declarations/runtime"

export type E2EScenarioInput = Omit<E2EScenario, "name">

export interface E2EScenario {
    name: string
    input: string

    compileOptions?: CompileOptions
    components?: Record<string, string>
}

export type E2EScenarioName = E2EScenario["name"]

export interface E2EScenarioTestModule {
    scenario: E2EScenario
}

export type E2ETest = typeof import("../../tests/e2e/fixture").test
export type E2EExpect = typeof import("@playwright/test").expect

export interface E2ETestRegistrarHelpers {
    test: E2ETest
    expect: E2EExpect
}

export type E2ETestRegistrar = (helpers: E2ETestRegistrarHelpers) => void

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

export interface E2EPageEvaluator {
    evaluate: <T>(fn: () => T) => Promise<T>
}

export interface ProcessEnvHost {
    process?: {
        env?: Record<string, string | undefined>
    }
}

export interface E2EFixtures {
    visitScenario: (scenario: E2EScenarioInput) => Promise<void>
}

export type E2ECompileMode = "debug" | "non-debug"

export type ExpectedTemplateNode = Omit<Partial<TemplateNode>, "children"> & {
    children?: ExpectedTemplateNode[]
}
