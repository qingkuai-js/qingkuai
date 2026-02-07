import type { TemplateNode } from "#type-declarations/compiler"

import { CodeWriter } from "./writer"
import { stringify } from "../../../util/shared/aliases"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { getStringifiedLiteral, shouldExtractCommonString } from "../../../util/compiler/sundry"
import { transformScript } from "./script"

export function generateRuntimeCode(nodes: TemplateNode[]) {
    let hasTopExtra = false

    const writer = new CodeWriter()
    const targetId = ensureIdentifierName("target")
    const contextId = ensureIdentifierName("context")
    const componentName = inputDescriptor.options.componentName
    const internalId = (analyzeResult.internalId = ensureIdentifierName("_"))
    const { importDeclarations, defaultProps, defaultRefs } = analyzeResult.script

    for (const declaration of importDeclarations) {
        writer.writeScriptNode(declaration.value).wrapLine()
    }
    writer.write(`import * as ${internalId} from "qingkuai/internal";`).wrapLine(2)

    // 重复使用的字符串字面量将被声明为常量，这里用于确定其标识符名称
    // Reused string literals will be declared as constants; this is used to determine their identifier names.
    traverseObject(analyzeResult.commonStrings, (key, value) => {
        if (shouldExtractCommonString(key, value.times)) {
            hasTopExtra = true
            value.id = ensureIdentifierName("__r__s", false)
            writer.write(`const ${value.id} = ${stringify(key)};`).wrapLine()
        }
    })

    hasTopExtra && writer.wrapLine()

    writer.write(`export default function ${componentName}(${targetId}, ${contextId}) {`)

    writeDelegateEventsRegistration(writer)

    writer.write(`const refs = ${internalId}.initRefs(${contextId}.r`)
    defaultRefs && writer.write(", ").writeScriptNode(defaultRefs.value)
    writer.write(");").wrapLine()

    writer.write(`const props = ${internalId}.initProps(${contextId}.p`)
    defaultProps && writer.write(", ").writeScriptNode(defaultProps.value)
    writer.write(");").wrapLine()

    writer.write(`const slots = ${internalId}.initSlots(${contextId}.s);`)
    writer.dedent().write("}")

    transformScript(writer)
    // console.log(writer.mappings)
    return writer.code
}

function ensureIdentifierName(name: string, prefix = true) {
    for (let i = 1, current = name; true; i++) {
        if (analyzeResult.script.fullIdentifiers.has(name)) {
            name = prefix ? "_" + name : name + i
            continue
        }
        return (analyzeResult.script.fullIdentifiers.add(name), name)
    }
}

// 生成 <interna>.init 方法调用代码，用于注册被委托的事件
// Generate code for the `<internal>.init` method call, used to register delegated events.
function writeDelegateEventsRegistration(writer: CodeWriter) {
    const passiveEvents: string[] = []
    const nonPassiveEvents: string[] = []
    const { delegateEvents } = analyzeResult.template
    traverseObject(delegateEvents, (_, value, index) => {
        const container = index ? nonPassiveEvents : passiveEvents
        for (const item of value) {
            container.push(getStringifiedLiteral(item))
        }
    })

    const passiveLen = passiveEvents.length
    const nonPassiveLen = nonPassiveEvents.length
    const shouldWrapLine = passiveLen + nonPassiveLen > 10
    const seperator = ", " + (shouldWrapLine ? "\n" : "")
    writer.indent().write(`${analyzeResult.internalId}.init([`)
    shouldWrapLine && writer.indent()

    writer.write(nonPassiveEvents.join(seperator))
    writer.write(seperator.repeat(nonPassiveLen ? (passiveLen ? 2 : 0) : 1))
    writer.write(passiveEvents.join(seperator))

    shouldWrapLine && writer.dedent()
    writer.write("]);").wrapLine(2)
}
