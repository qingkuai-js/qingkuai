import { test, expect } from "vitest"
import { compile } from "../../../../src/compiler/compile"
import { analyzeResult } from "../../../../src/compiler/state"

test("stage test: skips non-computed TS property signature keys", () => {
    compile(`
        <lang-ts>
            type T = { "skip_ts_property_signature_key": number }
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.skip_ts_property_signature_key).toBeUndefined()
})

test("stage test: keeps tagged template tag literal references", () => {
    compile(`
        <lang-ts>
            ("keep_tagged_template_tag_literal")\`x\`
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.keep_tagged_template_tag_literal?.times).toBe(1)
})

test("stage test: keeps enum member initializer literals", () => {
    compile(`
        <lang-ts>
            enum E {
                A = "keep_enum_initializer_literal"
            }
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.keep_enum_initializer_literal?.times).toBe(1)
})

test("stage test: skips string literals in TS literal type context", () => {
    compile(`
        <lang-ts>
            type Name = "skip_ts_literal_type_context"
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.skip_ts_literal_type_context).toBeUndefined()
})

test("stage test: keeps string literals in value-level type assertion chains", () => {
    compile(`
        <lang-ts>
            const a = (("keep_value_assertion_chain" as unknown) as string)
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.keep_value_assertion_chain?.times).toBe(1)
})

test("stage test: skips __proto__ object property key literal", () => {
    compile(`
        <lang-ts>
            const a = { "__proto__": 1 }
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.__proto__?.times).toBe(1)
})

test("stage test: keeps non-computed object property string keys as transformable references", () => {
    compile(`
        <lang-ts>
            const a = { "keep_object_property_key_literal": 1 }
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.keep_object_property_key_literal?.times).toBe(1)
})

test("stage test: keeps tagged template quasi literal content", () => {
    compile(`
        <lang-ts>
            function t(...args: any[]) { return args }
            t\`skip_tagged_template_quasi\`
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.skip_tagged_template_quasi?.times).toBe(1)
})

test("stage test: skips enum member string id literals", () => {
    compile(`
        <lang-ts>
            enum E {
                "skip_enum_member_id_literal" = 1
            }
        </lang-ts>
        <div></div>
    `)
    expect(analyzeResult.reusedStrings.skip_enum_member_id_literal).toBeUndefined()
})
