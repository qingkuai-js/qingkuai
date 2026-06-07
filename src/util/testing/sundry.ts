import type { GeneralFunc } from "#type-declarations/tools"
import type { StandaloneParseTemplateOptions } from "#type-declarations/compiler"

import { objectAssign } from "../shared/aliases"
import { afterAll, beforeAll, vi } from "vitest"
import { currentDestruction } from "../../runtime/state"
import { getLastElem, replaceEachItems } from "../shared/arrays"
import { PARSER_TEMPLATE_OPTIONS } from "../../compiler/constants"
import { createDestruction, destroy } from "../../runtime/destroy"
import { parseTemplateStandalone } from "../../compiler/parser/template"

export function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms))
}

export function initDestruction() {
    afterAll(() => {
        destroy(currentDestruction!)
    })
    beforeAll(() => {
        if (!currentDestruction) {
            createDestruction()
        }
    })
}

export function getCurrentEffect() {
    if (!currentDestruction?.e) {
        return null
    }
    return getLastElem(currentDestruction.e)
}

// 通过传入触发指定错误的方法，捕获后返回错误信息
// Capture and return the error message by passing a function that triggers the specified error
export function getErrorMessage(makeErr: GeneralFunc) {
    try {
        makeErr()
    } catch (err: any) {
        return err.message
    }
}

// 基于 vi.spyOn 创建警告信息的捕获验证器
// Create a warning-capturing validator based on vi.spyOn
export function createWarningMatcher() {
    const warningArgs: any[] = []
    return objectAssign(
        vi.spyOn(console, "warn").mockImplementation((...args) => {
            replaceEachItems(warningArgs, args)
        }),
        {
            args: warningArgs
        }
    )
}

export function parseTemplateTesting(source: string, options: StandaloneParseTemplateOptions = {}) {
    return parseTemplateStandalone(source, {
        ...PARSER_TEMPLATE_OPTIONS,
        ...options
    })
}
