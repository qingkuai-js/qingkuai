import type {
    ASTLocation,
    TemplateNode,
    TemplateContext,
    TemplateAttribute,
    InterAttributeRecord,
    AttributeAnalysisRet,
    TransformInterpolationRet,
    PreprocessedTemplateAttribute,
    TransformInterpolationOptionalOptions
} from "../types"
import type { Expression } from "@babel/types"
import type { AnyObject, NumNum } from "../../util/types"
import type { AnyNode, EsPattern } from "../estree/types"

import {
    confirmAlias,
    getRangeByLoc,
    findSpecificAttr,
    markPositionFlag,
    recordInterExpression,
    recordInterCodeSnippets,
    getRecordedInterCodeLen,
    recordInterSnippetWithSpecificRange
} from "../../util/compiler/sundry"
import {
    InvalidEventFlag,
    InvalidComposeFlag,
    DuplicateEventFlags,
    InvalidKeyRelatedFlag,
    DirectiveValueIsIgnored,
    ConflictNormalKeyEventFlag,
    InvalidEventFlagForComponent
} from "../message/warn"
import {
    SPREAD_TAG,
    COULD_USE_REF_TAGS,
    IntercodeSnippetKind,
    MUST_PASS_VALUE_DIRECTIVES,
    KEY_RELATED_EVENT_FLAGS
} from "../constants"
import {
    parse,
    getIdentifiersFromPattern,
    getIdentifiersFromPatternWithPath
} from "../../util/compiler/estree"
import {
    stringify,
    kebab2Camel,
    normalStringify,
    findOutOfComment,
    findOutOfStringComment
} from "../../util/compiler/strings"
import {
    InvalidSlotAttr,
    InvalidRefAttr,
    SlotAttrIsEmpty,
    UnkonwDirective,
    DuplicateSlotAttr,
    DirectivesCantCoexist,
    MissingStartDirective,
    DuplicateAttributeKey,
    BadValueToForDirective,
    DynamicNameAttrForSlot,
    NameAttrForSlotIsEmpty,
    BasSlotDirectiveCarrier,
    RefuseReferenceAttribute,
    CanNotAcceptRefAttribute,
    DuplicateNameAttrForSlot,
    BadTargetForReferenceDom,
    BadEventListenerForSlotTag,
    BadValueToContextGenDirective,
    NoValueForRequiredValueAttribute,
    UseKeyDirectiveWithoutForDirective
} from "../message/error"
import { getAlias } from "./alias"
import { validIdentifierNameRE } from "../regular"
import { getLocByIndex } from "../../util/compiler/locations"
import { transformInterpolation } from "../transformer/interpolation"
import { newAttributeAnalysisRet } from "../../util/compiler/structure"
import { is, isAssignable, isInlineEventHandler } from "../estree/assert"
import { EventListenerFlag, EventWrapperFlag } from "../../util/shared/flag"
import { inputDescriptor, templateNodeToContextIdentifiers } from "../state"
import { isEmptyString, isNull, isString, isUndefined } from "../../util/shared/assert"

// apm: Attributes Priority Map
// apm是一个映射对象，它存储了一些指令名的优先等级（一个数字），数字越大，优先级越高，在调用preProcessAttr方法时，
// 指令将会被按照他们的优先级进行排序，其他指令（包括动态/引用属性、事件）优先级默认为0（优先级低于apm数组中的所有指令）
// 优先级：name > slot > #slot > #await > #catch > #then > #if > #elif > #else > #for > #key > 其他指令、属性、事件
//
// 为什么普通slot和name属性优先级高于指令：普通slot属性用于声明组件一级子节点作为插槽插入到哪个slot标签的位置，且其中不会访问#slot
// 指令产生的标识符，普通name属性在slot标签上用于声明其插槽名称（与组件一级子节点的普通slot属性绑定），提高它们的优先级可以确保其在
// #slot指令或检查模式下生成中间代码时记录slot标签属性位置（inputDescriptor.slotInfo)之前出现，以有效地防止二次遍历发生的次数
const apm = ["key", "for", "else", "elif", "if", "then", "catch", "await", "slot"].reduce(
    (ret, attr, index) => ({ ...ret, [`#${attr}`]: index + 1 }),
    { slot: 100, name: 101 } as AnyObject
)

export function analyzeAttribute(
    node: TemplateNode,
    isComponent: boolean,
    parentIsComponent: boolean,
    attrs: TemplateAttribute[],
    context: TemplateContext,
    existingSlotOfAnyTag: Set<string>,
    continueByDirective?: string,
    awaitExpression?: [number, string],
    selectRefValue?: [string, boolean]
): AttributeAnalysisRet {
    let pureKey: string
    let withAwait = false
    let forModuleFuncIndex = -1
    let hasSlotDirective = false

    const aliasArgs: TransformInterpolationRet[] = []
    const inlineEventItems = new WeakSet<TemplateAttribute>()
    const ret: AttributeAnalysisRet = newAttributeAnalysisRet({
        selectRefValue,
        awaitExpression
    })

    const { tag } = node
    const isSlot = tag === "slot"
    const isSpread = tag === SPREAD_TAG
    const isTS = inputDescriptor.script.isTS
    const nodeStartIndex = node.loc.start.index
    const interAnyValue = `0${isTS ? " as any" : ""}`
    const isCheckMode = inputDescriptor.options.check
    const insertComment = inputDescriptor.options.comment
    const isNormal = !isComponent && !isSlot && !isSpread
    const preProcessedAttr = preProcessAttr(attrs, tag, isComponent)
    const startTagNameEndIndex = nodeStartIndex + node.tag.length + 1

    // 它记录了开始标签名的范围索引（包括开头的<，例如<div的范围索引)
    const stnr: NumNum = [nodeStartIndex, startTagNameEndIndex] // Start Tag Name Range

    // 记录当前组件文件中的slot信息
    const recordSlotInfo = (name: string, loc: ASTLocation) => {
        if (!isUndefined(inputDescriptor.slotInfo[name])) {
            DuplicateNameAttrForSlot(name, loc)
        } else {
            inputDescriptor.slotInfo[name] = {
                properties: [],
                landingRange: getRangeByLoc(loc)
            }
        }
        ret.nameOfSlotTag = stringify(name)
    }

    // 记录组件一级子节点的slot属性信息
    const recordSlotAttributeInfo = (value: string, loc: ASTLocation) => {
        if (existingSlotOfAnyTag.has(value)) {
            DuplicateSlotAttr(value, node.parent!.tag, loc)
        }
        existingSlotOfAnyTag.add(value)
        ret.slotOfAnyTag = stringify(value)
    }

    /**
     * 获取name或slot属性节点，若其存在则一定为preProcessedAttr的前两个元素，原因见{@link apm}变量定义处注释
     */
    const getNameOrSlotAttribute = (name: "name" | "slot") => {
        if (preProcessedAttr[0]?.key.raw === name) {
            return preProcessedAttr[0]
        }
        if (preProcessedAttr[1]?.key.raw === name) {
            return preProcessedAttr[1]
        }
    }

    // 修改continueRE变量，这里需要检测此变量是否已经被赋值，若已被赋值则不能覆盖原来的值，避免
    // 低优先级的指令高优先级指令，例如await指令的后续指令正则表达式可能会被if/elif指令覆盖
    const setContinueInfo = (v: RegExp | null) => {
        ret.continueInfo.by = isNull((ret.continueInfo.re = v)) ? undefined : pureKey
    }

    // 记录组件一级子节点的slot属性的中间代码片段
    const recordSlotAttributeInterSnippet = () => {
        let [startSourceIndex, endSourceIndex] = [0, 0]
        const slotAttr = getNameOrSlotAttribute("slot")
        const slotName = slotAttr?.value.raw || "default"
        if (slotAttr) {
            endSourceIndex = slotAttr.value.loc.end.index
            startSourceIndex = slotAttr.value.loc.start.index
        } else {
            ;[startSourceIndex, endSourceIndex] = [nodeStartIndex, stnr[1]]
        }
        recordInterCodeSnippets([
            IntercodeSnippetKind.VoidSource,
            `__c__.GetSlotProp(${node.parent!.componentTag},`
        ])
        recordInterSnippetWithSpecificRange(
            normalStringify(slotName) + ")",
            startSourceIndex,
            endSourceIndex
        )
        recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, ";"])
    }

    // 组件一级子元素（slot内容）
    if (parentIsComponent) {
        // 未使用#slot指令时先将context.count加1（context固定存在）
        if (!findSpecificAttr(preProcessedAttr, /#slot/)) {
            context.count++
        }

        // 未使用slot属性时默认为default，报错位置与开始标签名称一致
        if (isUndefined(ret.slotOfAnyTag)) {
            recordSlotAttributeInfo("default", getLocByIndex(...stnr))
        }
    }

    // slot标签无name属性时默认使用default，报错/跳转位置与开始标签名称一致
    if (isSlot && !getNameOrSlotAttribute("name")?.value.raw) {
        recordSlotInfo("default", getLocByIndex(...stnr))
    }

    preProcessedAttr.forEach(attr => {
        const { key, value } = attr
        const [rk, rv, iv] = [key.raw, value.raw, attr.inferredValue]
        const keyRange: NumNum = [key.loc.start.index, key.loc.end.index]

        const trimedValue = rv.trim()
        const isRef = rk.startsWith("&")
        const isEvent = rk.startsWith("@")
        const isDynamic = rk.startsWith("!")
        const isDirective = rk.startsWith("#")
        const isInterpolation = isEvent || isDynamic || isDirective || isRef
        const pureKeyStartSourceIndex = key.loc.start.index + /\s*/.exec(rk)![0].length
        const trimedValueStartSourceIndex = value.loc.start.index + /\s*/.exec(rv)![0].length

        // prettier-ignore
        const trimedValueLoc = getLocByIndex(trimedValueStartSourceIndex, trimedValueStartSourceIndex + trimedValue.length)

        // 转换标签指令
        const transDirective = (
            exp: string,
            startSourceIndex: number,
            option?: TransformInterpolationOptionalOptions
        ) => {
            if (isCheckMode) {
                return recordInterExpression(exp, [startSourceIndex]), ""
            }

            return transformInterpolation(exp, startSourceIndex, context, {
                ...option,
                type: "directive",
                withInNormalTag: isNormal
            })
        }

        // 转换标签属性值
        const transAttrValue = (option?: TransformInterpolationOptionalOptions) => {
            let exp = rv ? trimedValue : iv

            // 当动态/引用属性或事件只存在key时，需要将中间代码中的值部分映射到属性名的位置
            if (isCheckMode) {
                if (isEvent && pureKey) {
                    const ast = parse(`_=${exp}`, 0, 0)?.body[0] as any
                    if (isInlineEventHandler(ast?.expression.right)) {
                        inlineEventItems.add(attr)
                    } else if (!isComponent && isTS) {
                        recordInterCodeSnippets([
                            IntercodeSnippetKind.VoidSource,
                            `__c__.SatisfyEventHandler<"${pureKey}">(`
                        ])
                        if (rv) {
                            recordInterCodeSnippets([trimedValueStartSourceIndex, exp])
                        } else {
                            recordInterSnippetWithSpecificRange(exp, ...keyRange)
                        }
                        recordInterCodeSnippets([IntercodeSnippetKind.SearchForward, ");"])
                    }
                }
                if (inlineEventItems.has(attr)) {
                    recordInterCodeSnippets([
                        IntercodeSnippetKind.VoidSource,
                        `{const $arg=__c__.GetEventHandler("${pureKey}");`
                    ])
                }
                if (!isEvent || inlineEventItems.has(attr) || isComponent || !isTS) {
                    recordInterExpression(exp, rv ? [trimedValueStartSourceIndex] : keyRange)
                }
                if (inlineEventItems.has(attr)) {
                    recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, "};"])
                }
                if (isNormal && inlineEventItems.has(attr)) {
                    for (let i = 0; i < attr.value.raw.length; i++) {
                        markPositionFlag(i + attr.value.loc.start.index, "inNormalTagInlineEvent")
                    }
                }
                return ""
            }

            option = Object.assign(option || {}, {
                attributeWithNoValue: !rv,
                positionMap: attr.positionMap
            })

            const startSourceIndex = rv ? trimedValueStartSourceIndex : keyRange[0] + 1
            return transformInterpolation(exp, startSourceIndex, context, {
                ...option,
                type: "attribute",
                withInNormalTag: isNormal,
                normalClassRange: attr.normalClassRange
            })
        }

        // for，then/catch和slot指令记录标识符的逻辑一致，提取到这里分别调用即可
        const recordAliasIdentifiers = () => {
            if (isEmptyString(trimedValue)) {
                context.count++
                return
            }
            if (isCheckMode) {
                ret.contextBlockCount++
                recordInterCodeSnippets(
                    [IntercodeSnippetKind.SearchBackward, "{const "],
                    [trimedValueStartSourceIndex, trimedValue],
                    [IntercodeSnippetKind.SearchForward, "="]
                )
                if (pureKey === "slot") {
                    recordSlotAttributeInterSnippet()
                } else if (!awaitExpression) {
                    recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, interAnyValue + ";"])
                } else {
                    recordInterCodeSnippets(
                        [IntercodeSnippetKind.VoidSource, "__c__.GetResolve("],
                        awaitExpression!,
                        [IntercodeSnippetKind.SearchForward, ");"]
                    )
                }
                return
            }

            const ast = parse(`(${trimedValue})`, 1, trimedValueStartSourceIndex)
            const expressionNode = (ast?.body[0] as any).expression as Expression
            if (is(expressionNode, "Identifier")) {
                extendContext(node, context, expressionNode.name)
            } else if (
                is(expressionNode, "ArrayExpression") ||
                is(expressionNode, "ObjectExpression")
            ) {
                const endIndex = expressionNode.loc!.end.index - 1
                const startIndex = expressionNode.loc!.start.index - 1
                const startSourceIndex = trimedValueStartSourceIndex + startIndex
                const tir = makeDestructuringPatternSignleLine(
                    trimedValue.slice(startIndex, endIndex),
                    startSourceIndex
                )
                recordDestructuringIdentifiers(
                    node,
                    tir,
                    aliasArgs,
                    context,
                    false,
                    context.count++,
                    startSourceIndex
                )
            } else {
                BadValueToContextGenDirective(rk, trimedValueLoc)
            }
        }

        // pureKey为去掉!@#&前缀的属性名，如果是组件，还需将串型命名转换为驼峰命名
        if ((pureKey = rk.slice(+isInterpolation)) && isComponent) {
            pureKey = kebab2Camel(pureKey)
        }

        // 标记属性的开始位置
        markPositionFlag(key.loc.start.index, "isAttributeStart")
        isInterpolation && markPositionFlag(key.loc.start.index, "isInterpolationAttributeStart")

        // 处理引用值，如果是组件，就把引用传递放在eventStu的位置
        if (isRef) {
            let needSetter = true
            let eventName = tag === "textarea" ? "input" : "change"

            // 检查普通标签上的引用属性是否合法，不同的元素可接受的引用属性不同：
            // 1. input（radio/checkbox)：&checked
            // 2. input（text）、select或textarea标签：&value
            // 注意：若input元素的type属性为插值属性，它将不能接受任何引用属性
            if (!isComponent && pureKey !== "dom") {
                let tagForErr = tag
                let attrForError = ""
                let attrIsNotAllowed = false

                if (!COULD_USE_REF_TAGS.has(tag) && pureKey !== "dom") {
                    return CanNotAcceptRefAttribute(pureKey, tag, attr.loc)
                }

                switch (tag) {
                    case "textarea": {
                        attrIsNotAllowed = pureKey !== (attrForError = "value")
                    }
                    case "select": {
                        const multipleAttr = findSpecificAttr(preProcessedAttr, /^!?multiple$/)
                        if (multipleAttr?.key.raw.startsWith("!")) {
                            RefuseReferenceAttribute("select", "multiple", attr.loc)
                        }
                        needSetter = !multipleAttr
                        attrIsNotAllowed = pureKey !== (attrForError = "value")
                        !attrIsNotAllowed && (ret.selectRefValue = [iv, !!multipleAttr])
                    }
                    default: {
                        const typeAttr = findSpecificAttr(preProcessedAttr, /^!?type$/)
                        if (typeAttr?.key.raw.startsWith("!")) {
                            RefuseReferenceAttribute("input", "type", attr.loc)
                        }

                        const typeValueRaw = typeAttr?.value.raw ?? ""
                        if (!/^(?:radio|checkbox)$/.test(typeValueRaw)) {
                            eventName = "input"
                            tagForErr = `${tag}[type="${typeValueRaw || "text"}"]`
                            attrIsNotAllowed = pureKey !== (attrForError = "value")
                        } else {
                            tagForErr = `${tag}[type="${typeValueRaw}"]`
                            attrIsNotAllowed = pureKey !== (attrForError = "checked")
                        }
                    }
                }

                if (attrIsNotAllowed) {
                    return InvalidRefAttr(tagForErr, attrForError, pureKey, attr.loc)
                }
            }

            // &dom不能用于SPREAD_TAG和slot标签
            if (pureKey === "dom" && (isSlot || isSpread)) {
                return BadTargetForReferenceDom(attr.loc)
            }

            // 检查模式下select的&value属性不合法时将ret.selectRefValue置为undefined
            if (isCheckMode && ret.selectRefValue && rv) {
                const ast = parse(`_=${rv}`, 2, value.loc.start.index) as any
                if (!ast || !isAssignable(ast.body[0].expression.right)) {
                    ret.selectRefValue = undefined
                }
            }

            // 非检查模式时正常编译，检查模式下记录中间代码片段
            if (!isCheckMode) {
                const tiGetter = transAttrValue()
                const tiSetter = transAttrValue({ usedAsSetter: true })
                let setter = isString(tiSetter) ? tiSetter : tiSetter.transformedExp
                if (isComponent) {
                    // slot是特殊属性，不会被当做组件props，引用传递时要报错
                    if (pureKey === "slot") {
                        InvalidSlotAttr("&", key.loc)
                    } else {
                        const postfix = `, ${setter}]`
                        const prefix = `${stringify(pureKey)}, [`
                        ret.eventStu.push(concatStrAndTIR(prefix, tiGetter, postfix))
                    }
                } else if (pureKey !== "dom") {
                    const spk = stringify(pureKey)
                    const sev = stringify(eventName)
                    const funcName = getAlias("withReference")
                    const prefix = `...${funcName}(${sev}, ${spk}, `

                    // select[multiple]元素上的&value引用属性无setter
                    ret.eventStu.push(
                        concatStrAndTIR(prefix, tiGetter, `${needSetter ? `, ${setter}` : ""})`)
                    )
                } else {
                    ret.attributeStu.push(stringify("&dom"), transAttrValue({ usedAsSetter: true }))
                }
            } else {
                if (isTS && !isComponent) {
                    const recordValueCheckSnippet = (type: string, suffix = ")") => {
                        recordInterCodeSnippets([
                            IntercodeSnippetKind.VoidSource,
                            `__c__.Satisfy${type}(`
                        ])
                        if (rv) {
                            recordInterCodeSnippets(
                                [trimedValueStartSourceIndex, trimedValue],
                                [IntercodeSnippetKind.SearchForward, suffix]
                            )
                        } else {
                            recordInterSnippetWithSpecificRange(iv + suffix, ...keyRange)
                        }
                    }
                    switch (pureKey) {
                        case "checked": {
                            recordValueCheckSnippet("Boolean")
                            break
                        }
                        case "value": {
                            if (tag !== "select") {
                                recordValueCheckSnippet("String")
                            } else if (ret.selectRefValue?.[1]) {
                                recordValueCheckSnippet("MultipleSelect", ",")
                            }
                            break
                        }
                        case "dom": {
                            recordValueCheckSnippet(`Element<${normalStringify(tag)}>`, "!)")
                            break
                        }
                    }
                    if (isTS && ret.selectRefValue?.[1]) {
                        recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, "0 as any)"])
                    }
                    recordInterCodeSnippets([IntercodeSnippetKind.SearchForward, ";"])
                }

                // 将引用属性的值记录为一个括号表达式（表达式前一个位置为空格时表示此处禁止常量）
                // 它在中间代码中的开始索引被记录在inputDescriptor.refAttrValueStartIndexes中
                if (rv) {
                    const allowConst = ret.selectRefValue?.[1]
                    inputDescriptor.refAttrValueStartIndexes.push(
                        getRecordedInterCodeLen() + Number(!allowConst)
                    )
                    recordInterCodeSnippets([
                        IntercodeSnippetKind.VoidSource,
                        `${allowConst ? "" : " "}(`
                    ])
                    if (rv) {
                        recordInterCodeSnippets(
                            [value.loc.start.index, rv],
                            [IntercodeSnippetKind.SearchForward, ");"]
                        )
                    } else {
                        recordInterSnippetWithSpecificRange(iv + ")", ...keyRange)
                        recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, ";"])
                    }
                }
            }
        } else if (isDirective) {
            outter: switch (pureKey) {
                case "for": {
                    let itemPart = ""
                    let indexPart = ""
                    let baseValue = ""
                    let itemPartIsDestructuring = false
                    let indexPartIsDestructuring = false
                    let itemPartRange: NumNum | null = null
                    let indexPartRange: NumNum | null = null
                    let baseValueRange: NumNum | null = null
                    let hasContextIdentifier: boolean = false
                    const ofKeywordIndex = findOutOfStringComment(trimedValue, / of(?: |$)/)

                    const isPartNodeValid = (node: AnyNode) => {
                        return (
                            is(node, "Identifier") ||
                            is(node, "ArrayExpression") ||
                            is(node, "ObjectExpression")
                        )
                    }

                    if (ofKeywordIndex === -1) {
                        baseValue = trimedValue
                        baseValueRange = [0, trimedValue.length]
                    } else {
                        const exp = `(${trimedValue.slice(0, ofKeywordIndex)})`
                        const ast = parse(exp, 1, trimedValueStartSourceIndex)?.body[0]
                        baseValueRange = [ofKeywordIndex + 4, trimedValue.length]
                        baseValue = trimedValue.slice(ofKeywordIndex + 4)
                        hasContextIdentifier = true

                        if (!is(ast, "ExpressionStatement")) {
                            BadValueToForDirective(trimedValueLoc)
                            break
                        }

                        switch (ast.expression.type) {
                            case "Identifier":
                            case "ArrayExpression":
                            case "ObjectExpression":
                                itemPartRange = [
                                    ast.expression.loc!.start.index - 1,
                                    ast.expression.loc!.end.index - 1
                                ]
                                itemPartIsDestructuring = !is(ast.expression, "Identifier")
                                break
                            case "SequenceExpression":
                                const [firstNode, secondNode] = ast.expression.expressions
                                if (
                                    !isPartNodeValid(firstNode) ||
                                    !isPartNodeValid(secondNode) ||
                                    ast.expression.expressions.length !== 2
                                ) {
                                    BadValueToForDirective(trimedValueLoc)
                                    break outter
                                }
                                itemPartRange = [
                                    firstNode.loc!.start.index - 1,
                                    firstNode.loc!.end.index - 1
                                ]
                                indexPartRange = [
                                    secondNode.loc!.start.index - 1,
                                    secondNode.loc!.end.index - 1
                                ]
                                itemPartIsDestructuring = !is(firstNode, "Identifier")
                                indexPartIsDestructuring = !is(secondNode, "Identifier")
                                break
                            default:
                                BadValueToForDirective(trimedValueLoc)
                                break outter
                        }
                    }

                    !isNull(itemPartRange) && (itemPart = trimedValue.slice(...itemPartRange))
                    !isNull(indexPartRange) && (indexPart = trimedValue.slice(...indexPartRange))
                    !isNull(baseValueRange) && (baseValue = trimedValue.slice(...baseValueRange))

                    if (findOutOfComment(baseValue, /\S/) === -1) {
                        BadValueToForDirective(
                            trimedValueStartSourceIndex,
                            trimedValueStartSourceIndex + trimedValue.length
                        )
                        break
                    }

                    const preContextCount = context.count
                    ret.contextBlockCount += Number(hasContextIdentifier)

                    // 转换for指令依赖的表达式部分（不含item及index标识符部分）
                    const transformedForBaseValue = transDirective(
                        baseValue,
                        trimedValueStartSourceIndex + baseValueRange[0]
                    )

                    // 处理for指令上下文绑定
                    if (hasContextIdentifier) {
                        // 即使index部分不存在也占用context中一个标识符空间
                        if (!indexPart) {
                            context.count++
                        } else if (indexPartIsDestructuring) {
                            const startSourceIndex =
                                trimedValueStartSourceIndex + indexPartRange![0]
                            const tir = makeDestructuringPatternSignleLine(
                                indexPart,
                                startSourceIndex
                            )
                            context.count++
                            recordDestructuringIdentifiers(
                                node,
                                tir,
                                aliasArgs,
                                context,
                                true,
                                preContextCount,
                                startSourceIndex
                            )
                        } else {
                            extendContext(node, context, indexPart, "")
                        }

                        // 即使item部分不存在也占用context中一个标识符空间
                        if (!itemPart) {
                            context.count++
                        } else if (itemPartIsDestructuring) {
                            const startSourceIndex = trimedValueStartSourceIndex + itemPartRange![0]
                            const tir = makeDestructuringPatternSignleLine(
                                itemPart,
                                startSourceIndex
                            )
                            context.count++
                            recordDestructuringIdentifiers(
                                node,
                                tir,
                                aliasArgs,
                                context,
                                true,
                                preContextCount + 1,
                                startSourceIndex
                            )
                        } else {
                            extendContext(node, context, itemPart, "")
                        }
                    }

                    // 记录forModule调用结构在directiveStu中的索引
                    forModuleFuncIndex = ret.directiveStu.length

                    // 记录for指令结构（forModule方法调用结构，transformTemplate中使用）
                    ret.directiveStu.push([getAlias("forModule"), transformedForBaseValue])

                    if (isCheckMode) {
                        if (!hasContextIdentifier) {
                            recordInterCodeSnippets(
                                [IntercodeSnippetKind.VoidSource, "__c__.GetKVPair("],
                                [trimedValueStartSourceIndex, trimedValue],
                                [IntercodeSnippetKind.SearchForward, ");"]
                            )
                        } else {
                            recordInterCodeSnippets([
                                IntercodeSnippetKind.SearchBackward,
                                "{const ["
                            ])
                            if (indexPart) {
                                recordInterCodeSnippets([
                                    trimedValueStartSourceIndex + itemPartRange![0],
                                    trimedValue.slice(itemPartRange![0], indexPartRange![1])
                                ])
                            } else {
                                recordInterCodeSnippets([
                                    trimedValueStartSourceIndex + itemPartRange![0],
                                    itemPart
                                ])
                            }
                            recordInterCodeSnippets(
                                [IntercodeSnippetKind.SearchForward, "]"],
                                [IntercodeSnippetKind.VoidSource, "=__c__.GetKVPair("],
                                [trimedValueStartSourceIndex + baseValueRange![0], baseValue],
                                [IntercodeSnippetKind.SearchForward, ");"]
                            )
                        }
                    }
                    break
                }
                case "key": {
                    if (forModuleFuncIndex === -1) {
                        UseKeyDirectiveWithoutForDirective(attr.loc)
                    } else {
                        const transRet = transDirective(rv, -1, { isKeyDirective: true })
                        ret.directiveStu[forModuleFuncIndex][0] = getAlias("keyedForModule")
                        ret.directiveStu[forModuleFuncIndex].push(transRet)
                    }
                    break
                }
                case "if":
                case "elif":
                case "else": {
                    // 使用elif或else指令的节点的前一个兄弟节点必须使用了if或elif指令
                    if (
                        /^el(?:if|se)$/.test(pureKey) &&
                        !/^(?:el)?if$/.test(continueByDirective || "")
                    ) {
                        MissingStartDirective(rk, "#if or #elif", key.loc)
                    }

                    // continueArg是多条连接指令中的参数，目前只有if-elif-else需要设置它，因为它们被编译到一个
                    // ifModule方法调用中，而每个指令都会产生一条判断语句并需要传递给ifModule，但他们在不同的节点中，
                    // 所以这里通过将传递给analyzeTemplate方法，并analyzeTemplate方法中组合ifModule调用结构
                    if (pureKey === "else") {
                        ret.continueInfo.arg = "1"
                        setContinueInfo(null)
                        rv && DirectiveValueIsIgnored(rk, attr.loc)
                    } else {
                        let transRet: TransformInterpolationRet
                        if (isCheckMode) {
                            transRet = ""
                            ret.contextBlockCount++
                            recordInterCodeSnippets(
                                [IntercodeSnippetKind.VoidSource, `if(`],
                                [trimedValueStartSourceIndex, rv],
                                [IntercodeSnippetKind.SearchForward, "){"]
                            )
                        } else {
                            transRet = transDirective(rv, trimedValueStartSourceIndex)
                        }
                        if (pureKey === "elif") {
                            ret.continueInfo.arg = transRet
                        } else {
                            ret.createSpread = true
                            ret.directiveStu.push([getAlias("ifModule"), transRet])
                        }
                        setContinueInfo(/^#(?:elif|else)$/)
                    }
                    break
                }
                case "then":
                case "catch":
                case "await": {
                    if (pureKey === "await") {
                        if (isCheckMode) {
                            recordInterCodeSnippets(
                                [IntercodeSnippetKind.VoidSource, "__c__.SatisfyPromise("],
                                [trimedValueStartSourceIndex, trimedValue],
                                [IntercodeSnippetKind.SearchForward, ");"]
                            )
                            awaitExpression = [trimedValueStartSourceIndex, trimedValue]
                        } else {
                            const transRet = transDirective(rv, trimedValueStartSourceIndex)
                            ret.directiveStu.push([getAlias("awaitModule"), transRet])
                        }
                        withAwait = ret.createSpread = true
                        setContinueInfo(/^#(?:then|catch)$/)
                    } else {
                        // 使用了then指令的节点必须同时使用了await指令或前一个兄弟节点使用了await指令
                        if (pureKey === "then" && !withAwait && continueByDirective !== "await") {
                            MissingStartDirective(rk, "#await", attr.loc)
                        }

                        // 使用了catch指令的节点必须同时使用了await指令或前一个兄弟节点使用了await/then指令
                        if (
                            !withAwait &&
                            pureKey === "catch" &&
                            !/^(?:await|then)$/.test(continueByDirective || "")
                        ) {
                            MissingStartDirective(rk, "#await or #then", attr.loc)
                        }

                        recordAliasIdentifiers()

                        // insertNullNum表示需要插入的NIL的数量，当await指令和then指令在同一个元素上使用时，
                        // 相当于await指令元素不存在，需要插入一个NIL，而当await指令和catch指令在同一个元素上
                        // 使用时，相当于await指令元素和then指令元素都不存在，需要插入两个null
                        if (pureKey !== "catch") {
                            setContinueInfo(/^#catch$/)
                        } else {
                            setContinueInfo(null)
                        }
                        if (withAwait) {
                            ret.insertNullNum = pureKey === "then" ? 1 : 2
                        }
                    }
                    if (continueByDirective === "await" && pureKey === "catch") {
                        ret.insertNullNum = 1
                    }
                    break
                }
                case "slot": {
                    // 父元素非组件，不能使用slot指令
                    if (parentIsComponent) {
                        hasSlotDirective = true
                        recordAliasIdentifiers()
                    } else {
                        BasSlotDirectiveCarrier(key.loc)
                    }
                    break
                }
                case "target": {
                    if (isTS && isCheckMode) {
                        recordInterCodeSnippets(
                            [IntercodeSnippetKind.VoidSource, "__c__.SatisfyTargetDirective("],
                            [trimedValueStartSourceIndex, trimedValue],
                            [IntercodeSnippetKind.SearchForward, ");"]
                        )
                    } else {
                        ret.directiveStu.push([getAlias("targetModule"), transAttrValue()])
                    }
                    break
                }
                case "html": {
                    if (!isCheckMode) {
                        if (isEmptyString(tag) || isSpread) {
                            ret.directiveStu.push([
                                getAlias("unescapeModule"),
                                rv ? transAttrValue() : "{}"
                            ])
                        }
                    } else {
                        recordInterCodeSnippets(
                            [IntercodeSnippetKind.VoidSource, "__c__.SatisfyHtmlDirective("],
                            [trimedValueStartSourceIndex, trimedValue],
                            [IntercodeSnippetKind.SearchForward, ");"]
                        )
                    }
                    break
                }
                case "show": {
                    ret.directiveStu.push([getAlias("showModule"), transAttrValue()])
                    break
                }
                default: {
                    UnkonwDirective(rk, key.loc)
                }
            }
        } else if (isEvent) {
            if (isSlot) {
                return BadEventListenerForSlotTag(rk, attr.loc)
            }

            let eventFlag = 0
            let flagComment = ""
            let eventName = pureKey
            let eventWrapperFlag = 0

            const existingFlags = new Set<string>()
            const duplicateFlags = new Set<string>()

            const eventFlagArr: string[] = []
            const eventWrapperFlagArr: string[] = []
            const existingKeyRelatedFlags: string[] = []
            const flagArrWithIndex: [string, number, number][] = []

            const flagStartIndex = pureKey.indexOf("|")
            const flagArr = pureKey.slice(flagStartIndex + 1).split("|")
            const flagStartSourceIndex = pureKeyStartSourceIndex + flagStartIndex + 1
            flagStartIndex !== -1 && (eventName = eventName.slice(0, flagStartIndex))

            // flagArrWithIndex记录了每个flag的名称及开始结束索引
            for (let i = 0; i < flagArr.length; i++) {
                const preLen = flagArr[i - 1]?.length || 0
                const preIndex = flagArrWithIndex[i - 1]?.[1] || 0
                flagArrWithIndex.push([
                    flagArr[i],
                    preIndex + preLen + 1,
                    preIndex + preLen + flagArr[i].length + 1
                ])
            }

            if (flagStartIndex !== -1) {
                eventName = eventName.slice(0, flagStartIndex)
                if (isComponent) {
                    InvalidEventFlagForComponent(
                        flagArr.map(item => item.trim()).join(", "),
                        flagStartSourceIndex,
                        key.loc.end.index
                    )
                } else {
                    flagArrWithIndex.forEach(item => {
                        const [flag, startIndex, endIndex] = item
                        const endSourceIndex = flagStartSourceIndex + endIndex
                        const startSourceIndex = flagStartSourceIndex + startIndex
                        const currentFlagNum = (EventListenerFlag as any)[flag]
                        const currentWrapperFlagNum = (EventWrapperFlag as any)[flag]
                        if (!currentFlagNum && !currentWrapperFlagNum) {
                            InvalidEventFlag(flag, eventName, startSourceIndex, endSourceIndex)
                        }
                        if (currentFlagNum) {
                            // 只有input事件可以使用compose修饰符
                            if (flag === "compose" && eventName !== "input") {
                                InvalidComposeFlag(eventName, startSourceIndex, endSourceIndex)
                            }

                            // 重复出现的修饰符记录到duplicateFlags
                            if (existingFlags.has(flag)) {
                                duplicateFlags.add(flag)
                            } else {
                                eventFlagArr.push(flag)
                                existingFlags.add(flag)
                                eventFlag |= currentFlagNum || 0
                            }
                        } else if (currentWrapperFlagNum) {
                            // 只有keyup、keydown和keypress事件可以使用普通按键修饰符
                            if (
                                KEY_RELATED_EVENT_FLAGS.has(flag) &&
                                !/^key(?:up|down|press)$/.test(eventName)
                            ) {
                                InvalidKeyRelatedFlag(
                                    flag,
                                    eventName,
                                    startSourceIndex,
                                    endSourceIndex
                                )
                            } else if (KEY_RELATED_EVENT_FLAGS.has(flag)) {
                                // 如果已经存在了普通按键修饰符，则先清空它们，并在之后重新追加
                                // 预期：多个普通按键修饰符时，最后一个优先级最高并应用最后一个修饰符
                                //
                                // 注意：此处代码的正确性依赖EventWrapperFlag中flag的声明顺序，
                                // 即：(1 << 9) - 1 === (1 << 0) | (1 << 1) | ... | (1 << 8)
                                if (existingKeyRelatedFlags.length > 0) {
                                    eventWrapperFlag &= ~((1 << 9) - 1)
                                }
                                if (!existingFlags.has(flag)) {
                                    existingKeyRelatedFlags.push(flag)
                                }
                            }

                            // 重复出现的修饰符记录到duplicateFlags
                            if (existingFlags.has(flag)) {
                                duplicateFlags.add(flag)
                            } else {
                                existingFlags.add(flag)
                                eventWrapperFlagArr.push(flag)
                                eventWrapperFlag |= currentWrapperFlagNum || 0
                            }
                        }
                    })

                    // 普通按键修饰符存在多个时发出警告
                    if (existingKeyRelatedFlags.length > 1) {
                        ConflictNormalKeyEventFlag(
                            existingKeyRelatedFlags,
                            flagStartSourceIndex,
                            key.loc.end.index
                        )
                    }

                    // 存在重复的修饰符时发出警告
                    if (duplicateFlags.size > 0) {
                        DuplicateEventFlags(
                            Array.from(duplicateFlags),
                            eventName,
                            flagStartSourceIndex,
                            key.loc.end.index
                        )
                    }
                }
            }

            if (!isComponent) {
                const tir = transAttrValue({
                    eventWrapper: {
                        flag: eventWrapperFlag,
                        flagDescription: eventWrapperFlagArr.join(", ") || "no flag"
                    }
                })
                if (!tir) {
                    return
                }
                if (insertComment) {
                    if (eventFlag === 0) {
                        flagComment = "no flag"
                    } else {
                        flagComment = eventFlagArr.join(", ")
                    }
                    flagComment = `/* ${flagComment} */ `
                }

                const prefix = `${stringify(eventName)}, `
                const postfix = `, ${flagComment}${eventFlag}`
                ret.eventStu.push(concatStrAndTIR(prefix, tir, postfix))
            } else {
                const tir = transAttrValue({ isComponentEvent: true })
                tir && ret.attributeStu.push(concatStrAndTIR(stringify(eventName) + ", ", tir, ""))
            }
        } else if ((isSlot && pureKey === "name") || (parentIsComponent && pureKey === "slot")) {
            // slot标签的name属性（或组件的一级子元素的slot属性）不能是动态的，也不能是引用的，且不能为空
            // 这里只需检测name或slot属性是不是动态类型即可，因为引用类型属性的处理不会经过这里的代码块
            const isSlotAttribute = pureKey === "slot"
            if (isDynamic) {
                if (isSlotAttribute) {
                    InvalidSlotAttr("!", key.loc)
                } else {
                    DynamicNameAttrForSlot(key.loc)
                }
            } else if (isEmptyString(rv)) {
                if (isSlotAttribute) {
                    SlotAttrIsEmpty(attr.loc)
                } else {
                    NameAttrForSlotIsEmpty(attr.loc)
                }
            } else {
                if (!isSlotAttribute) {
                    recordSlotInfo(rv, attr.loc)
                } else {
                    recordSlotAttributeInfo(rv, value.loc)
                }
            }
        } else {
            if (isCheckMode && isSlot && iv) {
                inputDescriptor.slotInfo[ret.nameOfSlotTag!].properties.push([
                    pureKey,
                    getRangeByLoc(key.loc),
                    isInterpolation ? (rv ? trimedValueStartSourceIndex : keyRange[0]) : rv
                ])
            }

            const tir = isInterpolation
                ? transAttrValue()
                : isEmptyString(rv)
                ? "!0"
                : stringify(rv, true)
            tir && ret.attributeStu.push(concatStrAndTIR(`${stringify(pureKey)}, `, tir, ""))
        }
    })

    // 中间代码：验证option标签的value是否可被父元素（select）的&value接受
    if (isTS && isCheckMode && selectRefValue && tag === "option") {
        const [target, isMultiple] = selectRefValue
        const valueAttr = findSpecificAttr(preProcessedAttr, "!value")
        if (!isMultiple) {
            let assignValueAndSpecificRange: [string, number, number]
            if (!valueAttr?.value.raw && valueAttr?.quote !== "none") {
                assignValueAndSpecificRange = ['""', ...stnr]
            } else if (valueAttr.quote === "none") {
                assignValueAndSpecificRange = [
                    "value",
                    valueAttr.key.loc.start.index,
                    valueAttr.key.loc.end.index
                ]
            } else {
                assignValueAndSpecificRange = [
                    valueAttr.value.raw,
                    valueAttr.value.loc.start.index,
                    valueAttr.value.loc.end.index
                ]
            }
            recordInterSnippetWithSpecificRange(
                target + "=",
                assignValueAndSpecificRange[1],
                assignValueAndSpecificRange[2]
            )
            recordInterCodeSnippets([
                IntercodeSnippetKind.VoidSource,
                assignValueAndSpecificRange[0]
            ])
        } else {
            recordInterCodeSnippets([
                IntercodeSnippetKind.VoidSource,
                `__c__.SatisfyMultipleSelect(${target},`
            ])
            if (valueAttr && !valueAttr.value.raw && valueAttr.quote !== "none") {
                recordInterSnippetWithSpecificRange(
                    "value",
                    valueAttr.key.loc.start.index,
                    valueAttr.key.loc.end.index
                )
            } else if (!valueAttr?.value.raw) {
                recordInterSnippetWithSpecificRange('""', ...stnr)
            } else {
                recordInterCodeSnippets([valueAttr.value.loc.start.index, valueAttr.value.raw])
            }
            recordInterCodeSnippets([IntercodeSnippetKind.SearchForward, ")"])
        }
        recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, ";"])
    }

    // 设置aliasModule调用结构
    if (aliasArgs.length) {
        ret.directiveStu.push([getAlias("aliasModule"), ...aliasArgs])
    }

    // 检查模式时，需要为组件标签生成实例化的相关中间代码（指令的中间代码与其他标签处理一致），
    // 组件的普通属性/动态属性/事件、引用属性、slots会被组合为组件构造函数的三个对象类型参数
    if (isCheckMode && isComponent) {
        const attrRecords = Array.from({ length: 2 }, () => {
            return [] as InterAttributeRecord[]
        })

        preProcessedAttr.forEach(attr => {
            const [rk, rv, iv] = [attr.key.raw, attr.value.raw, attr.inferredValue]
            const keyRange: NumNum = [attr.key.loc.start.index, attr.key.loc.end.index]
            const valueRange: NumNum = [attr.value.loc.start.index, attr.value.loc.end.index]

            // 跳过指令和未指定名称的插值属性处理
            const isSpecial = /^[!@&]/.test(rk)
            const camelPureKey = kebab2Camel(rk.slice(+isSpecial))
            if (rk.startsWith("#") || !camelPureKey) {
                return
            }

            const target = attrRecords[+rk.startsWith("&")]
            const noEqualSign = keyRange[1] === attr.loc.end.index
            const isValidIdentifier = validIdentifierNameRE.test(camelPureKey)
            target.push({
                type: "key",
                range: keyRange,
                specificRange: true,
                value: isValidIdentifier ? camelPureKey : normalStringify(camelPureKey)
            })
            target.push({
                type: "value",
                specificRange: !rv,
                value: isSpecial
                    ? iv
                        ? inlineEventItems.has(attr)
                            ? interAnyValue
                            : iv
                        : interAnyValue
                    : noEqualSign
                    ? "true"
                    : normalStringify(iv),
                range: rv ? valueRange : keyRange
            })
        })

        // 记录组件实例化中间代码（new ComponentName）
        recordInterCodeSnippets([IntercodeSnippetKind.VoidSource, "new "])
        recordInterSnippetWithSpecificRange(`${node.componentTag}(`, ...stnr)

        for (const target of attrRecords) {
            recordInterCodeSnippets([stnr[0], "{"])
            target.forEach((item, index) => {
                const isKey = item.type === "key"
                const isLast = index === target.length - 1
                const suffix = isKey ? ":" : isLast ? "" : ","
                if (!item.specificRange) {
                    recordInterCodeSnippets([item.range[0], item.value])
                    suffix && recordInterCodeSnippets([IntercodeSnippetKind.SearchForward, suffix])
                } else {
                    const specificSnippet = item.value + (suffix || " ")
                    recordInterSnippetWithSpecificRange(specificSnippet, ...item.range)
                }
            })
            recordInterCodeSnippets([IntercodeSnippetKind.SearchForward, "}"], [stnr[1], ","])
        }
        recordInterCodeSnippets([IntercodeSnippetKind.SearchForward, `${interAnyValue});`])
    }

    // slot节点未使用slot指令时记录slot属性相关的中间代码片段
    if (isCheckMode && parentIsComponent && !hasSlotDirective) {
        recordSlotAttributeInterSnippet()
    }
    return ret
}

// 该方法的主要用途是过滤重复的属性，此外方法还有以下功能：
// 1. 检查无效的属性、指令和事件名称（只有关键字符!@#&的情况）
// 1. 检查缺失值的指令、缺失值的动态属性及引用属性
// 2. 将多个class属性合并为一个动态class属性
// 3. 检查是否使用了非法的指令搭配组合
export function preProcessAttr(attributes: TemplateAttribute[], tag: string, isComponent: boolean) {
    let dynamicClassIndex = -1
    let normalClassIndex: number = -1
    let ifRelatedDirectivesCoexistState = ""
    let awiatRelatedDirectivesCoexistState = ""

    const ret: PreprocessedTemplateAttribute[] = []
    const isComponentOrSlot = isComponent || tag === "slot"
    const existingItem = new Map<string, PreprocessedTemplateAttribute[]>()

    for (let i = 0; i < attributes.length; i++) {
        const currentAttribute = attributes[i]
        const { key, value, loc } = currentAttribute

        const [rk, rv] = [key.raw, value.raw]
        const isClass = /^[!&]?class/.test(rk)
        const isSpecial = /^[!@#&]/.test(key.raw)
        const isDirective = key.raw.startsWith("#")
        const pureKey = !isSpecial ? rk : rk.slice(1)
        const isDynamicOrReference = /^[!&]/.test(rk)
        const noEqualSign = currentAttribute.key.loc.end.index === currentAttribute.loc.end.index

        const preProcessedItem: PreprocessedTemplateAttribute = {
            ...currentAttribute,
            inferredValue: rv || (isSpecial && noEqualSign ? kebab2Camel(pureKey) : "")
        }

        if (!noEqualSign && currentAttribute.quote === "none") {
            continue
        }

        // 检查是否使用了不能同时存在的指令搭配[if elif else]和[then catch]
        if (isDirective) {
            if (/^#(?:if|elif|else)$/.test(rk)) {
                if (!ifRelatedDirectivesCoexistState) {
                    ifRelatedDirectivesCoexistState = rk
                } else {
                    DirectivesCantCoexist([ifRelatedDirectivesCoexistState, rk], loc)
                }
            }
            if (/^#(?:then|catch)$/.test(rk)) {
                if (!awiatRelatedDirectivesCoexistState) {
                    awiatRelatedDirectivesCoexistState = rk
                } else {
                    DirectivesCantCoexist([awiatRelatedDirectivesCoexistState, rk], loc)
                }
            }
            // 检查必须传递属性值的属性是否有值
            if (MUST_PASS_VALUE_DIRECTIVES.has(pureKey) && !rv) {
                NoValueForRequiredValueAttribute(rk, loc)
                continue
            }
        }

        // 特殊情况：对于非组件标签上的class属性：动态和非动态class均可出现一次，rk相同且重复出现才会报错
        // 注意：这里需要单独检测是否是引用传递的class属性，因为多个class相关属性被合并为一个!class后分析属性时检查不出是否使用了&class
        if (isClass && !isComponentOrSlot) {
            if (!existingItem.has("!class")) {
                existingItem.set("!class", [])
            }

            if (
                (isDynamicOrReference && dynamicClassIndex !== -1) ||
                (!isDynamicOrReference && normalClassIndex !== -1)
            ) {
                DuplicateAttributeKey(tag, rk, rk, loc)
            }

            const target = existingItem.get("!class")!
            if (!isDynamicOrReference) {
                normalClassIndex = target.push(preProcessedItem) - 1
            } else {
                if (rk.startsWith("&")) {
                    CanNotAcceptRefAttribute(pureKey, tag, loc)
                }
                dynamicClassIndex = target.push(preProcessedItem) - 1
            }
            continue
        }

        // 任何完全相同的属性(包括指令、事件）都不能重复出现
        if (existingItem.has(rk)) {
            DuplicateAttributeKey(tag, rk, rk, loc)
            continue
        }

        // 任何标签上的普通属性名和动态属性名都不能重复
        if (
            (!isSpecial && existingItem.has("!" + rk)) ||
            (rk.startsWith("!") && existingItem.has(pureKey))
        ) {
            if (!isSpecial) {
                DuplicateAttributeKey(tag, "!" + rk, rk, loc)
            } else {
                DuplicateAttributeKey(tag, pureKey, rk, loc)
            }
            continue
        }

        // 根据传入的chars数组检查是否存在重复属性名
        const checkDuplicateWithChars = (chars: string[]) => {
            for (let existing = false, i = 0; i < chars.length; i++) {
                const combinedKey = chars[i] + pureKey
                if (!existingItem.has(combinedKey)) {
                    continue
                }
                if (!existing) {
                    existing = true
                }
                return DuplicateAttributeKey(tag, combinedKey, rk, loc), true
            }
        }

        // 组件上的普通属性、动态属性、事件名三者之间的任意两两组合视为重复
        if (isComponent && checkDuplicateWithChars(["", "!", "@"])) continue

        // textarea标签的value或input标签的value/checked属性：
        // 普通属性、动态属性、引用属性三者之间的任意两两组合视为重复
        if (
            (tag === "textarea" && pureKey === "value") ||
            (tag === "input" && /^value|checked$/.test(pureKey))
        ) {
            if (checkDuplicateWithChars(["", "!", "&"])) continue
        }

        existingItem.set(rk, [preProcessedItem])
    }

    // 整理属性值的格式：这里的规则是将普通或动态class合并为一个动态的class属性值并放在一个数组中，
    // 此格式是runtime需要的唯一格式，此时无需关注转换后的属性（包括键值）位置信息（均与第一项保持一致），
    // 因为如果它包含动态class就会在调用transformInterpolation时传入positionMap，并根据这个位置映射
    // 来记录需要生成sourcemap的位置，而如果它不包含动态class，则整个表达式都不会被记录sourcemap位置信息
    // 注意：检查模式下无需上述处理，以为检查模式会忽略普通class属性（纯字符串部分无需在检查模式下生成中间代码表示）
    existingItem.forEach((attrItems, attrKey) => {
        if (isComponentOrSlot || inputDescriptor.options.check || attrKey !== "!class") {
            return attrItems.forEach(item => ret.push(item))
        }

        const rawValues: string[] = []
        let normalClassRange: NumNum = [-1, -1]
        for (let i = 0, combinedLen = 1; i < attrItems.length; i++) {
            if (i !== normalClassIndex) {
                rawValues.push(attrItems[i].inferredValue)
                combinedLen += attrItems[i].inferredValue.length + 2
            } else {
                const normalArr = attrItems[i].inferredValue.split(/\s+/).filter(v => v)
                const joinedNormalClass = normalArr.map(v => normalStringify(v)).join(", ")
                normalClassRange = [combinedLen, combinedLen + joinedNormalClass.length]
                rawValues.push(joinedNormalClass)
            }
        }

        // positionMap用来存储位置映射信息，只有动态class值的部分会存在位置映射（动态值字符索引 -> 源码字符索引），
        // 在transformInterpolation方法中如果传入了位置映射信息，只有在表达式索引存在源码位置映射时才生成sourcemap
        // 例如，模板语法：class="aaa" !class="aaa"，转换后的class值为["aaa", aaa]，动态class在转换后的数组
        // 的第二个元素，所以positionMap只有下标为8，9，10的元素存在源码位置，访问其他下标都将得到undefined
        const positionMap: number[] = []

        if (inputDescriptor.options.sourcemap) {
            // 存在动态class时，记录转换后class值的位置映射（class值字符索引 -> 源码字符索引）
            // dynamicStartIndex表示动态class值在组合转换后的值中开始字符的索引，将从这一索引开始记录位置映射
            let dynamicStartIndex = 1
            if (dynamicClassIndex === 1) {
                // 这里的+2为拼接是添加的 逗号空格 的固定长度
                dynamicStartIndex += rawValues[0].length + 2
            }

            if (dynamicClassIndex !== -1) {
                const dynamicValueLoc = attrItems[dynamicClassIndex].value.loc
                for (let i = 0; i <= rawValues[dynamicClassIndex].length; i++) {
                    positionMap[dynamicStartIndex + i] = dynamicValueLoc.start.index + i
                }
            }
        }

        const transformedValue = rawValues.join(", ")
        ret.push({
            normalClassRange,
            loc: attrItems[0].loc,
            key: {
                raw: attrKey,
                loc: attrItems[0].key.loc
            },
            value: {
                raw: `[${transformedValue}]`,
                loc: attrItems[0].value.loc
            },
            quote: attrItems[0].quote,
            inferredValue: `[${transformedValue}]`,
            positionMap: positionMap.length ? positionMap : undefined
        })
    })

    /**
     * 属性排序，排序规则参考：{@link apm}
     */
    return ret.sort((a, b) => {
        const [ak, bk] = [a.key.raw, b.key.raw]
        return (apm[bk] || 0) - (apm[ak] || 0)
    })
}

// 将解构模式转换为单行模式，并记录开始和结束位置的映射(同TransformInterpolationRet中的mapping)
// 这里的映射的四个元素分别代表：源码索引、转换后的表达式列、源码行、源码列（转换后的表达式行都为1，无需记录）
// 此方法主要用来将for/then/catch/slot指令中的结构模式转换成单行模式并记录位置映射，以便之后生成sourcemap信息
function makeDestructuringPatternSignleLine(
    pattern: string,
    startSourceIndex: number
): TransformInterpolationRet {
    const { positions } = inputDescriptor
    const endSourceIndex = startSourceIndex + pattern.length
    const [startLoc, endLoc] = [positions[startSourceIndex], positions[endSourceIndex]]
    const transformedPattern = pattern.replace(/\s+/g, " ")
    return {
        transformedExp: transformedPattern,
        mappings: [
            [startSourceIndex, 0, startLoc.line, startLoc.column],
            [endSourceIndex, transformedPattern.length, endLoc.line, endLoc.column]
        ]
    }
}

/**
 * @description: 此方法用来扩展context，将指令（for、then、catch、slot）产生的上下文标识符记录到context中
 *
 * @param from 表示源码标识符名称（transformInterpolation方法中会将此标识符替换为上下文访问表达式）
 *
 * @param pathTo 是一个可选的字符串，未传入（为undefined）时扩展的context.map元素中path属性为空字符串，
 * path属性为访问当前上下文标识符时需要使用的路径，它应该和num属性配合使用，拼接为类似于ctx(num).path的格式，
 * 关于为什么要这样处理：可跳转到{@link recordDestructuringIdentifiers}方法定义处对isForDirective参数的注释
 */
function extendContext(
    node: TemplateNode,
    context: TemplateContext,
    from: string,
    pathTo?: string
) {
    const num = context.count++
    context.map.set(from, {
        num,
        path: pathTo || ""
    })
    if (templateNodeToContextIdentifiers.has(node)) {
        templateNodeToContextIdentifiers.get(node)!.add(from)
    } else {
        templateNodeToContextIdentifiers.set(node, new Set([from]))
    }
}

/**
 * 添加指令中解构语法产生的标识符到context中
 * @param source 解构模式代码；aliasArgs表示调用
 *
 * @param aliasArgs aliasModule方法时的参数列表，它是一个容器，由于存在于analyzeAttribute
 * 方法内部，所以只能通过参数传递来访问到它
 *
 * @param baseCtxIndex baseCtxIndex表示此结构语法基于的ctx调用编号，也就是当前解构语法是解构
 * 的哪个ctx调用，例如传入1时，解构就是基于ctx(1)进行的
 *
 * @param isForDirective 表示当前结构语法是否是在For指令中，是的话要记录路径访问到TemplateContext项
 * 中的path属性，这样做的原因是因为使用解构语法的for指令在编译后aliasModule调用在forModule的内层，所以
 * key指令中访问不到aliasModule添加的上下文目标，只能通过原路径访问，可以结合下面的示例进行理解这一过程：
 * 假设传入参数：source = "{ a: { b } }"，baseCtxIndex = 0，在非key指令区域均可以通过ctx(4)访问标识符b
 * 其中：ctx(1)为整个item，ctx(2)为整个index，ctx(3)为标识符a，但key指令只能通过 ctx(1).a.b 来访问标识符b
 */
function recordDestructuringIdentifiers(
    node: TemplateNode,
    tir: TransformInterpolationRet,
    aliasArgs: TransformInterpolationRet[],
    context: TemplateContext,
    isForDirective: boolean,
    baseCtxIndex: number,
    startSourceIndex: number
) {
    const identifiers = new Set<string>()
    const patternStr = isString(tir) ? tir : tir.transformedExp
    const declarationSourceCode = `const ${patternStr}={}`

    const ast = parse(declarationSourceCode, 6, startSourceIndex)?.body[0]
    const patternNode = (ast as any).declarations[0].id as EsPattern

    // 检查模式下的遇到babel内部错误时，直接返回
    if (isUndefined(ast)) return

    if (!isForDirective) {
        getIdentifiersFromPattern(patternNode).forEach(from => {
            identifiers.add(from)
            extendContext(node, context, from)
        })
    } else {
        getIdentifiersFromPatternWithPath(declarationSourceCode, patternNode).forEach(
            (path, from) => {
                identifiers.add(from)
                extendContext(node, context, from, path)
            }
        )
    }

    // 更新tir中的tranformedExp为解构函数，并更新mappings中的表达式结束位置（下标为1）
    const ctxParam = confirmAlias("ctx", identifiers)
    const identifierStr = Array.from(identifiers).join(", ")
    const destructuringFunc = `(${patternStr}) => [${identifierStr}]`
    if (isString(tir)) {
        tir = destructuringFunc
    } else {
        tir.transformedExp = destructuringFunc
        tir.mappings[1][1] = destructuringFunc.length
    }
    aliasArgs.push(`${ctxParam} => ${ctxParam}(${baseCtxIndex})`, tir)
}

// 为transformInterpolation的返回值（转换后的表达式）拼接字符串前缀和后缀，如果返回值中存在mappings
// 还会将mappings中所有段的生成列（下标为1的元素）向右偏移前缀字符串长度的数量以保证正确的源码映射
function concatStrAndTIR<T extends TransformInterpolationRet>(
    prefix: string,
    tir: T,
    postfix: string
): T {
    if (isString(tir)) {
        return (prefix + tir + postfix) as any
    }
    tir.mappings.forEach(item => {
        item[1] += prefix.length
    })
    return (tir.transformedExp = prefix + tir.transformedExp + postfix), tir
}
