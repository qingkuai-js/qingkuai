import type {
    ComponentRefs,
    ComponentProps,
    ComponentSlots,
    ComponentExports,
    ComponentContexts,
    ComponentOfInstance
} from "../../../src/types/runtime-ex"
import type { EmptyObject } from "../../../src/types/brand"
import type { QingkuaiComponent } from "@qingkuai/virtual/brand"
import type { __qk__lsu as LSU } from "../../../src/types/qingkuai"
import type { ComponentInstance } from "../../../src/types/runtime"

import {
    setContext,
    getContexts,
    setContextGetter,
    getCurrentInstance
} from "../../../src/runtime/component"
import { describe, expect, expectTypeOf, test } from "vitest"

// validateHandleReceiver 声明于语言服务 d.ts，无运行时实现，此处仅借用其签名
// validateHandleReceiver is declared in the language-service d.ts with no
// runtime implementation; only its signature is borrowed here
const lsValidateHandleReceiver: typeof LSU.validateHandleReceiver = {} as any

type StrictRender = (ctx: {
    props: {
        title: string
        count?: number
    }
    refs: {
        input: HTMLInputElement
    }
    contexts: {
        theme: string
        getCount: () => number
    }
    slots: {
        header: (context: { subtitle: string }) => void
    }
}) => {
    exportA: string
    methodB: () => void
}
type StrictInstance = ComponentInstance<typeof strictComp>

declare const strictInstance: StrictInstance
declare const strictComp: QingkuaiComponent<StrictRender>

declare const anyComp: QingkuaiComponent<any>
declare const anyInstance: ComponentInstance<typeof anyComp>

// 无契约注解的组件：降级为宽松签名
// A component without a contract annotation: degrades to a permissive signature
declare const bareComp: QingkuaiComponent<
    () => {
        exportA: string
    }
>
declare const bareInstance: ComponentInstance<typeof bareComp>

// 显式空 contexts 契约的组件：签名收窄为 key: never，任何写入均为类型错误
// An explicitly empty contexts contract: the signature collapses to
// key: never — every write is a type error
declare const emptyCtxComp: QingkuaiComponent<
    (ctx: { props: {}; refs: {}; slots: {}; contexts: {} }) => void
>
declare const emptyCtxInstance: ComponentInstance<typeof emptyCtxComp>

// EmptyObject 标记契约（LS 对未声明 contexts 的组件注入的形态）：同样收窄为
// key: never
// A marker-based EmptyObject contract (injected by the LS for components
// without declared contexts): likewise collapses to key: never
declare const markerEmptyComp: QingkuaiComponent<
    (ctx: { props: {}; refs: {}; slots: {}; contexts: EmptyObject }) => void
>
declare const markerEmptyInstance: ComponentInstance<typeof markerEmptyComp>

// symbol 键的 contexts 契约：与字符串键平权，严格校验
// A symbol-keyed context contract: enforced strictly like string keys
declare const symKey: unique symbol
declare const symComp: QingkuaiComponent<
    (ctx: { props: {}; refs: {}; slots: {}; contexts: { [symKey]: string } }) => void
>
declare const symInstance: ComponentInstance<typeof symComp>

// 以下 exercise 函数仅用于承载类型断言，绝不执行——实例在运行时是 undefined，
// 类型检查由 tsc --noEmit 完成，@ts-expect-error 行由 tsc 验证确有错误
//
// The following exercise functions are only for carrying type assertions and
// are never executed — the instances are undefined at runtime, and type checking
// is performed by tsc --noEmit; the @ts-expect-error lines are verified by tsc to
// indeed be errors
describe("component contract utility types", () => {
    test("extracts the props contract", () => {
        expectTypeOf<ComponentProps<typeof strictComp>>().toEqualTypeOf<{
            title: string
            count?: number
        }>()
    })

    test("extracts the refs contract", () => {
        expectTypeOf<ComponentRefs<typeof strictComp>>().toEqualTypeOf<{
            input: HTMLInputElement
        }>()
    })

    test("extracts the slots contract", () => {
        expectTypeOf<ComponentSlots<typeof strictComp>>().toEqualTypeOf<{
            header: (context: { subtitle: string }) => void
        }>()
    })

    test("extracts the contexts contract", () => {
        expectTypeOf<ComponentContexts<typeof strictComp>>().toEqualTypeOf<{
            theme: string
            getCount: () => number
        }>()
    })

    test("extracts the exported data", () => {
        expectTypeOf<ComponentExports<typeof strictComp>>().toEqualTypeOf<{
            exportA: string
            methodB: () => void
        }>()
    })

    test("degrades to permissive records for unannotated or any-typed components", () => {
        expectTypeOf<ComponentProps<typeof anyComp>>().toEqualTypeOf<any>()
        expectTypeOf<ComponentContexts<typeof bareComp>>().toEqualTypeOf<any>()
        expectTypeOf<ComponentExports<typeof anyComp>>().toEqualTypeOf<any>()
    })
})

describe("component instance type channel", () => {
    test("instance exposes exported data but not the contract layers", () => {
        expectTypeOf<StrictInstance["exportA"]>().toEqualTypeOf<string>()
        expectTypeOf<StrictInstance>().not.toHaveProperty("contexts")
    })

    test("recovers the component type through the phantom channel", () => {
        expectTypeOf<ComponentOfInstance<StrictInstance>>().toEqualTypeOf<
            QingkuaiComponent<StrictRender>
        >()
        expectTypeOf<ComponentOfInstance<ComponentInstance<typeof anyComp>>>().toEqualTypeOf<
            QingkuaiComponent<any>
        >()
    })
})

describe("setContext contract checking", () => {
    test("accepts valid keys and values on a contract-declaring component", () => {
        const exercise = () => {
            setContext(strictInstance, "theme", "dark")
            setContext(strictInstance, "getCount", () => 42)
            setContextGetter(strictInstance, "getCount", () => () => 42)
        }
        expect(typeof exercise).toBe("function")
    })

    test("rejects unknown keys on a contract-declaring component", () => {
        const exercise = () => {
            // @ts-expect-error — "unknown" is not in the context contract
            setContext(strictInstance, "unknown", "x")

            // @ts-expect-error — "unknown" is not in the context contract
            setContextGetter(strictInstance, "unknown", () => "x")
        }
        expect(typeof exercise).toBe("function")
    })

    test("rejects mismatched value types on a contract-declaring component", () => {
        const exercise = () => {
            // @ts-expect-error — value must be a string
            setContext(strictInstance, "theme", 123)

            // @ts-expect-error — getter must return a number
            setContext(strictInstance, "getCount", () => "not-a-number")
        }
        expect(typeof exercise).toBe("function")
    })

    test("permissive only for unannotated or any-typed components", () => {
        const exercise = () => {
            setContext(anyInstance, "anything", 123)
            setContext(bareInstance, "anything", { deep: true })
            setContextGetter(anyInstance, "anything", () => "x")

            // @ts-expect-error — no key was allowed
            setContext(emptyCtxInstance, "anything", null)

            // @ts-expect-error — no key was allowed
            setContextGetter(emptyCtxInstance, "anything", () => "x")

            // @ts-expect-error — no key was allowed
            setContext(markerEmptyInstance, "anything", null)

            // @ts-expect-error — no key was allowed
            setContextGetter(markerEmptyInstance, "anything", () => "x")
        }
        expect(typeof exercise).toBe("function")
    })

    test("enforces symbol-keyed context contracts", () => {
        const exercise = () => {
            setContext(symInstance, symKey, "dark")
            setContextGetter(symInstance, symKey, () => "dark")

            // @ts-expect-error — key not in the context contract
            setContext(symInstance, "other", "x")
            // @ts-expect-error — value must be a string
            setContext(symInstance, symKey, 123)
        }
        expect(typeof exercise).toBe("function")
    })

    test("getContexts preserves the contract type", () => {
        const exercise = () => getContexts(strictInstance)!.theme
        expectTypeOf<ReturnType<typeof exercise>>().toEqualTypeOf<string>()
    })
})

describe("typed instance entry points", () => {
    test("validateHandleReceiver validates the receiver's declared instance type", () => {
        const exercise = () => {
            let inst: StrictInstance | null = null
            lsValidateHandleReceiver(strictComp, inst)
            expectTypeOf(getContexts(inst!)!.theme).toEqualTypeOf<string>()
            expectTypeOf(inst!.exportA).toEqualTypeOf<string>()
        }
        expect(typeof exercise).toBe("function")
    })

    test("validateHandleReceiver rejects receivers typed for other shapes", () => {
        const exercise = () => {
            let wrong = { nope: 1 }
            // @ts-expect-error — receiver type is incompatible with the instance type
            lsValidateHandleReceiver(strictComp, wrong)

            let notAComponent = { nope: 1 }
            // @ts-expect-error — plain objects are not components
            lsValidateHandleReceiver(notAComponent, notAComponent)
        }
        expect(typeof exercise).toBe("function")
    })

    test("validateHandleReceiver keeps element-tag typing intact", () => {
        const exercise = () => {
            let el: HTMLInputElement | null = null
            lsValidateHandleReceiver("input", el)
        }
        expect(typeof exercise).toBe("function")
    })

    test("getCurrentInstance accepts a component type for contract-typed access", () => {
        const exercise = () => {
            const typed = getCurrentInstance<typeof strictComp>()
            expectTypeOf(typed).toEqualTypeOf<StrictInstance | null>()
            expectTypeOf(getContexts(typed!)!.theme).toEqualTypeOf<string>()

            const loose = getCurrentInstance()
            expectTypeOf(loose).toEqualTypeOf<ComponentInstance<typeof anyComp> | null>()
        }
        expect(typeof exercise).toBe("function")
    })
})
