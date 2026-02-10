import { test } from "vitest"
import { resetCompilerState } from "../../../src/compiler/state"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { parseTemplate } from "../../../src/compiler/parser/template"
import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { analyzeTemplate } from "../../../src/compiler/analyzer/template"
import { generateRuntimeCode } from "../../../src/compiler/transformer/runtime/codegen"

function transform(source: string) {
    const templateNodes = (resetCompilerState({}), parseTemplate(formatSourceCode(source)))
    ;(analyzeScript(), analyzeTemplate(templateNodes))
    return generateRuntimeCode(templateNodes)
}

test("", () => {
    const ret = transform(`
        <lang-ts>
        </lang-ts>
    `)
})
