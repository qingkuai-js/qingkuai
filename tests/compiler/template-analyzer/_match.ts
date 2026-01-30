import type { ExpectedCompileMessage } from "#type-declarations/testing"

import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { matchCompileMessages } from "../../../src/util/testing/match"
import { analyzeTemplate } from "../../../src/compiler/analyzer/template"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"

export function analyzeTemplateAndMatchMessages(
    source: string,
    expectedMessages: ExpectedCompileMessage[] = []
) {
    const nodes = parseTemplateStandalone(source, {
        recover: true
    })
    analyzeScript()
    analyzeTemplate(nodes)
    matchCompileMessages(expectedMessages)
}
