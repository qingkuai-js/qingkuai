import type { ExpectedCompileMessage } from "#type-declarations/testing"

import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { matchCompileMessages } from "../../../src/util/testing/match"
import { parseTemplateTesting } from "../../../src/util/testing/sundry"
import { analyzeTemplate } from "../../../src/compiler/analyzer/template"

export function analyzeTemplateAndMatchMessages(
    source: string,
    expectedMessages: ExpectedCompileMessage[] = []
) {
    const nodes = parseTemplateTesting(`${source}`, {
        recover: true
    })
    analyzeScript()
    analyzeTemplate(nodes)
    matchCompileMessages(expectedMessages)
}
