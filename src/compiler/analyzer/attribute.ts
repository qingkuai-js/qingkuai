import type {
    TemplateNode,
    TemplateContext,
    TemplateAttribute,
    AttributeAnalysisRet,
    TransformInterpolationRet,
    FilteredTemplateAttribute,
    TransformInterpolationOptionalParam,
    ASTLocation
} from "../types"
import type { EsPattern } from "../estree/types"
import type { AnyObject, FixedArray, StartBracket } from "../../util/types"

import {
    confirmAlias,
    findSpecificAttr,
    markPositionFlag,
    checkIdentifierName,
    recordInterExpression,
    recordInterWithSpecificRange
} from "../../util/compiler/sundry"
import {
    stringify,
    kebab2Camel,
    findOutOfSC,
    normalStringify,
    findEndCurlyBracket
} from "../../util/compiler/strings"
import {
    InvalidEventFlag,
    DuplicateEventModifiers,
    InvalidComposeModifier,
    InvalidKeyRelatedModifier,
    InvalidEventFlagForComponent,
    ConflictNormalKeyEventModifier
} from "../message/warn"
import {
    validIdentifierNameRE,
    DestructuringContextRE,
    expressionReplaceWithSpaceRE
} from "../regular"
import {
    parse,
    getIdentifiersFromPattern,
    getIdentifiersFromPatternWithPath
} from "../../util/compiler/estree"
import {
    InvalidSlotAttr,
    InvalidRefAttr,
    SlotAttrIsEmpty,
    UnkonwDirective,
    DirectivesCantCoexist,
    MissingStartDirective,
    DuplicateAttributeKey,
    DynamicNameAttrForSlot,
    NameAttrForSlotIsEmpty,
    BasSlotDirectiveCarrier,
    RefuseReferenceAttribute,
    CanNotAcceptRefAttribute,
    NoBaseValueForForDirective,
    BadEventListenerForSlotTag,
    NoForDirectiveCtxNameSpeciffied,
    NoValueForRequiredValueAttribute,
    UseKeyDirectiveWithoutForDirective,
    DuplicateNameAttrForSlot,
    DuplicateSlotAttr
} from "../message/error"
import { getAlias } from "./alias"
import { lastElem } from "../../util/shared/sundry"
import { getLocByIndex } from "../../util/compiler/locations"
import { inputDescriptor, interCodeSnippets } from "../state"
import { transformInterpolation } from "../transformer/interpolation"
import { EventListenerFlag, EventWrapperFlag } from "../../util/shared/flag"
import { isEmptyString, isNull, isString, isUndefined } from "../../util/shared/assert"
import { couldUseRefTags, keyRelatedEventModifiers, mustPassValueDirectives } from "../constants"

// apm: Attributes Priority Map
// apm是一个映射对象，它存储了一些指令名的优先等级（一个数字），数字越大，优先级越高，在调用preProcessAttr方法时，
// 指令将会被按照他们的优先级进行排序，其他指令（包括动态/引用属性、事件）优先级默认为0（优先级低于apm数组中的所有指令）
// 指令优先级：slot > #slot > #await > #catch > #then > #if > #elif > #else > #for > #key > 其他指令、属性、事件
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
    awaitExpression?: [number, string]
): AttributeAnalysisRet {
    let pureKey: string
    let insertNullNum = 0
    let withAwait = false
    let contextBlockCount = 0
    let createTemplate = false
    let forModuleFuncIndex = -1
    let hasSlotDirective = false
    let continueRE: RegExp | null = null
    let shouldContinueDirective: string | undefined
    let slotOfAnyTag: string | undefined = undefined
    let nameOfSlotTag: string | undefined = undefined
    let continueArg: TransformInterpolationRet | undefined

    const { tag } = node
    const isSlot = tag === "slot"
    const isTS = inputDescriptor.script.isTS
    const nodeStartIndex = node.loc.start.index
    const isCheckMode = inputDescriptor.options.check
    const eventStu: TransformInterpolationRet[] = []
    const aliasArgs: TransformInterpolationRet[] = []
    const attributeStu: TransformInterpolationRet[] = []
    const directiveStu: TransformInterpolationRet[][] = []
    const preProcessedAttr = preProcessAttr(attrs, tag, isComponent)
    const startTagNameEndIndex = nodeStartIndex + node.tag.length + 1

    // 它记录了开始标签名的范围索引（包括开头的<，例如<div的范围索引)
    const stnr = [nodeStartIndex, startTagNameEndIndex] as const // Start Tag Name Range

    // 它记录了slot属性的相关信息：名称（包括单/双引号）以及插槽名称报错/跳转时的源码位置范围
    const slotAttributeInfo: [string, number, number] = ['"default"', ...stnr]

    // 记录当前组件文件中的slot信息
    const recordSlotInfo = (name: string, loc: ASTLocation) => {
        if (!isUndefined(inputDescriptor.slotInfo[name])) {
            DuplicateNameAttrForSlot(name, loc)
        } else {
            inputDescriptor.slotInfo[name] = {
                properties: [],
                landingIndex: loc.start.index
            }
        }
        nameOfSlotTag = stringify(name)
    }

    // 修改continueRE变量，这里需要检测此变量是否已经被赋值，若已被赋值则不能覆盖原来的值，避免
    // 低优先级的指令高优先级指令，例如await指令的后续指令正则表达式可能会被if/elif指令覆盖
    const setContinueInfo = (v: RegExp | null) => {
        shouldContinueDirective = isNull((continueRE = v)) ? undefined : pureKey
    }

    // 记录slot节点中间代码片段的方法，当属性值未被单双引号包裹时无需处理
    const recoedSlotAttributeInterSnippet = () => {
        const [slotName, ...range] = slotAttributeInfo
        if (!/^['"]/.test(slotName)) {
            return
        }

        const parsedSlotName = JSON.parse(slotName)
        if (!existingSlotOfAnyTag.has(parsedSlotName)) {
            existingSlotOfAnyTag.add(parsedSlotName)
        } else {
            DuplicateSlotAttr(parsedSlotName, node.parent!.tag, ...range)
        }

        const equalSign = hasSlotDirective ? "=" : ""
        const parentComponentTag = node.parent!.componentTag
        interCodeSnippets.push([-1, `${equalSign}__c__.getSlotProp(`])
        recordInterWithSpecificRange(`${parentComponentTag},`, stnr[0] + 1, stnr[1])

        // 当if条件成立时表示无slot属性
        if (range[0] === nodeStartIndex) {
            recordInterWithSpecificRange(slotName, ...stnr)
        } else {
            interCodeSnippets.push([range[0], slotName])
        }

        interCodeSnippets.push([-2, ");"])
    }

    // slot标签无name属性时默认使用default，报错/跳转位置与开始标签名的范围一致
    // 如果存在name属性，则它一定是第一个元素，原因参考本文件顶部对于amp变量的注释
    if (isSlot && preProcessedAttr[0]?.key.raw !== "name") {
        recordSlotInfo("default", getLocByIndex(...stnr))
    }

    preProcessedAttr.forEach(attr => {
        const { key, value } = attr
        const [rk, rv] = [key.raw, value.raw]

        const trimedValue = rv.trim()
        const isRef = rk.startsWith("&")
        const isEvent = rk.startsWith("@")
        const isDynamic = rk.startsWith("!")
        const isDirective = rk.startsWith("#")
        const isInterpolation = isEvent || isDynamic || isDirective || isRef
        const pureKeyStartSourceIndex = key.loc.start.index + /\s*/.exec(rk)![0].length
        const trimedValueStartSourceIndex = value.loc.start.index + /\s*/.exec(rv)![0].length

        // 转换标签指令
        const transDirective = (
            exp: string,
            startSourceIndex: number,
            option?: TransformInterpolationOptionalParam
        ) => {
            if (isCheckMode) {
                recordInterExpression(startSourceIndex, exp)
            }
            return transformInterpolation(exp, startSourceIndex, context, "directive", option)
        }

        // 转换标签属性值
        const transAttrValue = (exp: string, option?: TransformInterpolationOptionalParam) => {
            if (isCheckMode) {
                // 当动态/引用属性或事件只存在key时，需要将中间代码中的值部分映射到属性名的位置
                let keyRange: FixedArray<number, 2> | undefined = undefined
                if (value.loc.start.index === -1) {
                    keyRange = [key.loc.start.index, key.loc.end.index - 1]
                }
                recordInterExpression(trimedValueStartSourceIndex, exp, keyRange)
            }

            if (!option) {
                option = {
                    positionMap: attr.positionMap
                }
            } else {
                option.positionMap = attr.positionMap
            }

            // prettier-ignore
            return transformInterpolation(exp, trimedValueStartSourceIndex, context, "attribute", option)
        }

        // then/catch和slot指令记录标识符的逻辑一致，提取到这里分别调用即可
        const recordAliasIdentifiers = () => {
            if (isEmptyString(trimedValue)) {
                context.count++
            } else {
                if (isCheckMode) {
                    contextBlockCount++
                    interCodeSnippets.push(
                        [-1, "{const "],
                        [trimedValueStartSourceIndex, trimedValue]
                    )

                    if (pureKey === "slot") {
                        recoedSlotAttributeInterSnippet()
                    } else if (pureKey === "slot") {
                        interCodeSnippets.push([-2, "=__c__.getResolve("])
                        interCodeSnippets.push(awaitExpression!, [-2, ");"])
                    } else {
                        interCodeSnippets.push([-2, `=0${isTS ? " as any" : ""};`])
                    }
                } else if (!DestructuringContextRE.test(trimedValue)) {
                    checkIdentifierName(
                        trimedValue,
                        getLocByIndex(
                            trimedValueStartSourceIndex,
                            trimedValueStartSourceIndex + trimedValue.length
                        )
                    )
                    extendContext(context, trimedValue)
                } else {
                    const tip = makeDestructuringPatternSignleLine(
                        trimedValue,
                        trimedValueStartSourceIndex
                    )
                    recordDestructuringIdentifiers(tip, aliasArgs, context, false, context.count++)
                }
            }
        }

        // pureKey为去掉!@#&前缀的属性名，如果是组件，还需将串型命名转换为驼峰命名
        if ((pureKey = rk.slice(+isInterpolation)) && isComponent) {
            pureKey = kebab2Camel(pureKey)
        }

        // 处理引用值，如果是组件，就把引用传递放在eventStu的位置
        // 由于select的value属性与普通属性的处理逻辑并不相同（需要判断子option元素的选择情况，
        // 初始化时要异步设置初始值）所以这里将select元素的value属性使用withReference进行处理
        // 但这种情况下最后一个参数（setter)会被传入nil，以打断选项改变时修改响应式值的渠道
        if (isRef || (tag === "select" && pureKey === "value")) {
            let needSetter = true
            let eventName = tag === "textarea" ? "input" : "change"

            // 检查普通标签上的引用属性是否合法，对于input元素（非radio/checkbox）、textarea元素或
            // select元素都只能接受&value，input（radio/checkbox）只能接受&checked，option元素
            // 只能接受&selected。另外：若input元素的具有动态type属性，它将不能接受任何引用属性
            if (!isComponent) {
                let tagForErr = tag
                let attrIsNotAllowed = false
                let attrsForErr: string[] = []

                if (!couldUseRefTags.has(tag)) {
                    return CanNotAcceptRefAttribute(pureKey, tag, attr.loc)
                }

                // 检查普通标签上的引用属性是否合法，对于input元素（非radio/checkbox）、textarea元素或
                // select元素都只能接受&value，input（radio/checkbox）只能接受&checked，option元素
                // 只能接受&selected。另外：若input元素的具有动态type属性，它将不能接受任何引用属性
                if (tag === "input") {
                    const typeAttr = findSpecificAttr(preProcessedAttr, /^[!@#&]?type$/)
                    if (typeAttr?.key.raw.startsWith("!")) {
                        RefuseReferenceAttribute("input", "type", attr.loc)
                    }

                    const typeValueRaw = typeAttr?.value.raw ?? ""
                    if (/^(?:radio|checkbox)$/.test(typeValueRaw)) {
                        needSetter = pureKey !== "group"
                        attrsForErr = ["checked", "group"]
                        tagForErr = `${tag}[type="${typeValueRaw}"]`
                        attrIsNotAllowed = !/^(?:checked|group)$/.test(pureKey)
                    } else {
                        eventName = "input"
                        attrsForErr = ["value"]
                        attrIsNotAllowed = pureKey !== "value"
                        tagForErr = `${tag}[type="${typeAttr?.value.raw || "text"}"]`
                    }
                } else if (tag === "select") {
                    const multipleAttr = findSpecificAttr(preProcessedAttr, "multiple")
                    if (multipleAttr?.key.raw.startsWith("!")) {
                        RefuseReferenceAttribute("select", "multiple", attr.loc)
                    }
                    attrsForErr = ["value"]
                    needSetter = !multipleAttr
                    attrIsNotAllowed = pureKey !== "value"
                }

                // 检查引用传递的属性是否合法，允许的属性：input/textarea -> value；
                // radio/checkbox -> checked/group；select -> value
                if (attrIsNotAllowed) {
                    InvalidRefAttr(tagForErr, attrsForErr, pureKey, attr.loc)
                }
            }

            // 非检查模式时正常编译，检查模式下记录中间代码片段
            if (!isCheckMode) {
                const tiGetter = transAttrValue(trimedValue)
                const tiSetter = transAttrValue(trimedValue, { usedAsSetter: true })
                let setter = isString(tiSetter) ? tiSetter : tiSetter.transformedExp
                if (isComponent) {
                    // slot是特殊属性，不会被当做组件props，引用传递时要报错
                    if (pureKey === "slot") {
                        InvalidSlotAttr("&", key.loc)
                    } else {
                        const postfix = `, ${setter}]`
                        const prefix = `${stringify(pureKey)}, [`
                        eventStu.push(concatStrAndTIR(prefix, tiGetter, postfix))
                    }
                } else {
                    // select的value属性（非引用）时setter为null
                    // radio/checkbox(&group)或select[multiple](&value)时无setter
                    if (!needSetter) {
                        setter = ""
                    } else if (!isRef) {
                        setter = getAlias("nil")
                    }

                    if (setter) {
                        setter = ", " + setter
                    }

                    const spk = stringify(pureKey)
                    const sev = stringify(eventName)
                    const funcName = getAlias("withReference")
                    const prefix = `...${funcName}(${sev}, ${spk}, `
                    eventStu.push(concatStrAndTIR(prefix, tiGetter, setter))
                }
            } else {
                if (!isComponent && isTS) {
                    if (pureKey === "checked") {
                        interCodeSnippets.push(
                            [-3, `__c__.SatisfyBoolean(`],
                            [trimedValueStartSourceIndex, trimedValue]
                        )
                    } else if (pureKey === "value") {
                        interCodeSnippets.push(
                            [-3, `__c__.SatisfyString(`],
                            [trimedValueStartSourceIndex, trimedValue]
                        )
                    } else if (pureKey === "group") {
                        const valueAttr = preProcessedAttr.filter(attr => {
                            return /^[!@#&]?value/.test(attr.key.raw)
                        })?.[0]
                        interCodeSnippets.push(
                            [-3, `__c__.SatisfyRefGroup(`],
                            [trimedValueStartSourceIndex, trimedValue],
                            [-2, ","]
                        )

                        if (!isUndefined(valueAttr)) {
                            if (/[!@#&]/.test(valueAttr.key.raw[0])) {
                                interCodeSnippets.push([
                                    valueAttr.value.loc.start.index,
                                    valueAttr.value.raw
                                ])
                            } else {
                                interCodeSnippets.push([-1, "`"])
                                interCodeSnippets.push([
                                    valueAttr.value.loc.start.index,
                                    valueAttr.value.raw
                                ])
                            }
                        } else {
                            interCodeSnippets.push(
                                [trimedValueStartSourceIndex, '"'],
                                [trimedValueStartSourceIndex + trimedValue.length - 1, '"']
                            )
                        }
                    }
                    interCodeSnippets.push([-2, ");"])
                }

                // 普通标签的非group或非普通标签上的group引用属性时，检查给定值是否是左值（可赋值的目标）
                if (isComponent || (pureKey !== "group" && !isEmptyString(trimedValue))) {
                    interCodeSnippets.push(
                        [-2, "("],
                        [trimedValueStartSourceIndex, trimedValue],
                        [-2, `)=0${isTS ? " as any" : ""};`]
                    )
                }
            }
        } else if (isDirective) {
            switch (pureKey) {
                case "for":
                    const inKeywordIndex = findOutOfSC(trimedValue, / in(?: |$)/)
                    const hasContextIdentifier = inKeywordIndex !== -1
                    const contextStr = trimedValue.slice(0, inKeywordIndex).trim()
                    const baseStartIndex = hasContextIdentifier ? inKeywordIndex + 4 : 0
                    const forBaseValue = trimedValue.slice(baseStartIndex)
                    const basePreSpaceCount = /\s*/.exec(forBaseValue)![0].length

                    if (!forBaseValue && !isEmptyString(trimedValue)) {
                        NoBaseValueForForDirective(
                            trimedValueStartSourceIndex,
                            trimedValueStartSourceIndex + trimedValue.length
                        )
                        break
                    }
                    contextBlockCount += Number(hasContextIdentifier)

                    if (!isCheckMode) {
                        const preContextCount = context.count

                        // 转换for指令依赖的表达式部分（不含item及index标识符部分）
                        const transformedForBaseValue = transDirective(
                            trimedValue.slice(baseStartIndex).trim(),
                            trimedValueStartSourceIndex + baseStartIndex + basePreSpaceCount
                        )

                        // 处理for指令上下文绑定
                        if (hasContextIdentifier) {
                            let indexPart = ""
                            let itemPart: string
                            let commaFind: FixedArray<number, 2>

                            // 截取item部分的pattern，并找到commaFind（它是findOutOfSC的返回值，它是一个包含两个
                            // 数字的数组，这两个数字分别代表：逗号所在的索引，匹配字符的长度（逗号及前后空白字符的））
                            if (!DestructuringContextRE.test(contextStr)) {
                                const itemPartEndIndex = findOutOfSC(contextStr, /$|[,\s]/)
                                commaFind = findOutOfSC(contextStr, /\s*,\s*/, itemPartEndIndex)
                                itemPart = contextStr.slice(0, itemPartEndIndex)
                            } else {
                                const startBracket = contextStr[0] as StartBracket
                                const endBracketIndex = findEndCurlyBracket(
                                    contextStr,
                                    1,
                                    startBracket
                                )
                                commaFind = findOutOfSC(contextStr, /\s*,\s*/, endBracketIndex + 1)
                                itemPart = contextStr.slice(0, endBracketIndex + 1)
                            }

                            // 如果存在逗号时，检查item或index部分的名称是否未指定
                            const [commaStartIndex, commaMatchedLen] = commaFind
                            const commaEndIndex = commaStartIndex + commaMatchedLen
                            const commastartSourceIndex =
                                trimedValueStartSourceIndex + commaStartIndex
                            if (commaStartIndex !== -1) {
                                indexPart = contextStr.slice(commaEndIndex)
                                if (!itemPart || !indexPart) {
                                    NoForDirectiveCtxNameSpeciffied(
                                        itemPart ? "index" : "item",
                                        // +!itemPart 与 item? 0: 1 等效，其他地方也有相似处理
                                        getLocByIndex(commastartSourceIndex + +!itemPart)
                                    )
                                }
                            }

                            // 即使index部分不存在也占用context中一个标识符空间
                            if (!indexPart) {
                                context.count++
                            } else if (DestructuringContextRE.test(indexPart)) {
                                const tip = makeDestructuringPatternSignleLine(
                                    indexPart,
                                    trimedValueStartSourceIndex + commaEndIndex
                                )
                                recordDestructuringIdentifiers(
                                    tip,
                                    aliasArgs,
                                    context,
                                    true,
                                    preContextCount
                                )
                            } else {
                                checkIdentifierName(
                                    indexPart,
                                    getLocByIndex(
                                        commastartSourceIndex + commaMatchedLen,
                                        trimedValueStartSourceIndex + contextStr.length
                                    )
                                )
                                extendContext(context, indexPart, "")
                            }

                            // 即使item部分不存在也占用context中一个标识符空间
                            if (!itemPart) {
                                context.count++
                            } else if (DestructuringContextRE.test(itemPart)) {
                                const tip = makeDestructuringPatternSignleLine(
                                    itemPart,
                                    trimedValueStartSourceIndex
                                )
                                recordDestructuringIdentifiers(
                                    tip,
                                    aliasArgs,
                                    context,
                                    true,
                                    preContextCount + 1
                                )
                            } else {
                                checkIdentifierName(
                                    itemPart,
                                    getLocByIndex(
                                        trimedValueStartSourceIndex,
                                        trimedValueStartSourceIndex + itemPart.length
                                    )
                                )
                                extendContext(context, itemPart, "")
                            }
                        }

                        // 记录forModule调用结构在directiveStu中的索引
                        forModuleFuncIndex = directiveStu.length

                        // 记录for指令结构（forModule方法调用结构，transformTemplate中使用）
                        directiveStu.push([getAlias("forModule"), transformedForBaseValue])
                        //
                    } else {
                        if (!hasContextIdentifier) {
                            interCodeSnippets.push(
                                [-3, "__c__.GetKVPair("],
                                [trimedValueStartSourceIndex, trimedValue],
                                [-2, ");"]
                            )
                        } else {
                            interCodeSnippets.push(
                                [-1, "{const ["],
                                [trimedValueStartSourceIndex, contextStr],
                                [-3, "]=__c__.GetKVPair("],
                                [trimedValueStartSourceIndex + baseStartIndex, forBaseValue],
                                [-2, ");"]
                            )
                        }
                    }
                    break

                case "key":
                    if (forModuleFuncIndex === -1) {
                        UseKeyDirectiveWithoutForDirective(attr.loc)
                    } else {
                        const transRet = transDirective(rv, -1, { isKeyDirective: true })
                        directiveStu[forModuleFuncIndex][0] = getAlias("keyedForModule")
                        directiveStu[forModuleFuncIndex].push(transRet)
                    }
                    break

                case "if":
                case "elif":
                case "else":
                    // 使用elif指令的节点的前一个兄弟节点必须使用了if指令
                    if (pureKey === "elif" && continueByDirective !== "if") {
                        MissingStartDirective(rk, "#if", key.loc)
                    }

                    // 使用了else指令的节点的前一个兄弟节点必须使用了if/elif指令
                    if (pureKey === "else" && !/^(?:el)?if$/.test(continueByDirective || "")) {
                        MissingStartDirective(rk, "#if or #elif", key.loc)
                    }

                    // continueArg是多条连接指令中的参数，目前只有if-elif-else需要设置它，因为它们被编译到一个
                    // ifModule方法调用中，而每个指令都会产生一条判断语句并需要传递给ifModule，但他们在不同的节点中，
                    // 所以这里通过将传递给analyzeTemplate方法，并analyzeTemplate方法中组合ifModule调用结构
                    if (pureKey === "else") {
                        continueArg = "1"
                        setContinueInfo(null)
                    } else {
                        const transRet = transDirective(rv, trimedValueStartSourceIndex)
                        if (pureKey === "elif") {
                            continueArg = transRet
                        } else {
                            createTemplate = true
                            directiveStu.push([getAlias("ifModule"), transRet])
                        }
                        setContinueInfo(/^#(?:elif|else)$/)
                    }
                    break

                case "then":
                case "catch":
                case "await":
                    if (pureKey === "await") {
                        if (isCheckMode) {
                            if (isTS) {
                                interCodeSnippets.push(
                                    [-3, "__c__.SatisfyPromise("],
                                    [trimedValueStartSourceIndex, trimedValue],
                                    [-2, ");"]
                                )
                            }
                            awaitExpression = [trimedValueStartSourceIndex, trimedValue]
                        } else {
                            const transRet = transDirective(rv, trimedValueStartSourceIndex)
                            directiveStu.push([getAlias("awaitModule"), transRet])
                        }
                        withAwait = createTemplate = true
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

                        // insertNullNum表示需要插入的nil的数量，当await指令和then指令在同一个元素上使用时，
                        // 相当于await指令元素不存在，需要插入一个nil，而当await指令和catch指令在同一个元素上
                        // 使用时，相当于await指令元素和then指令元素都不存在，需要插入两个null
                        if (pureKey !== "catch") {
                            setContinueInfo(/^#catch$/)
                        } else {
                            setContinueInfo(null)
                        }
                        if (withAwait) {
                            insertNullNum = pureKey === "then" ? 1 : 2
                        }
                    }
                    if (continueByDirective === "await" && pureKey === "catch") {
                        insertNullNum = 1
                    }
                    break

                case "slot":
                    // 父元素非组件，不能使用slot指令
                    if (parentIsComponent) {
                        hasSlotDirective = true
                        recordAliasIdentifiers()
                    } else {
                        BasSlotDirectiveCarrier(key.loc)
                    }
                    break

                default:
                    if (!isEmptyString(pureKey)) {
                        UnkonwDirective(rk, key.loc)
                    }
                //
                // switch code block end here
                //
            }
        } else if (isEvent) {
            if (isSlot) {
                return BadEventListenerForSlotTag(rk, attr.loc)
            }

            let eventFlag = 0
            let flagComment = ""
            let eventName = pureKey
            let eventWrapperFlag = 0

            const existringModifiers = new Set<string>()
            const duplicateModifiers = new Set<string>()

            const eventModifierArr: string[] = []
            const eventWrapperModifierArr: string[] = []
            const existingKeyRelatedModifiers: string[] = []
            const modifierArrWithIndex: [string, number, number][] = []

            const modifierStartIndex = pureKey.indexOf("|")
            const modifierArr = pureKey.slice(modifierStartIndex + 1).split("|")
            const modifierStartSourceIndex = pureKeyStartSourceIndex + modifierStartIndex
            modifierStartIndex !== -1 && (eventName = eventName.slice(0, modifierStartIndex))

            // flagArrWithIndex记录了每个flag的名称及开始结束索引
            for (let i = 0; i < modifierArr.length; i++) {
                const preLen = modifierArr[i - 1]?.length || 0
                const preIndex = modifierArrWithIndex[i - 1]?.[1] || 0
                modifierArrWithIndex.push([
                    modifierArr[i],
                    preIndex + preLen + 1,
                    preIndex + preLen + modifierArr[i].length + 1
                ])
            }

            if (modifierStartIndex !== -1) {
                eventName = eventName.slice(0, modifierStartIndex)
                if (isComponent) {
                    InvalidEventFlagForComponent(
                        modifierArr.map(item => item.trim()).join(", "),
                        modifierStartSourceIndex,
                        key.loc.end.index
                    )
                } else {
                    modifierArrWithIndex.forEach(item => {
                        const [modifier, startIndex, endIndex] = item
                        const endSourceIndex = modifierStartSourceIndex + endIndex
                        const startSourceIndex = modifierStartSourceIndex + startIndex
                        const currentFlagNum = (EventListenerFlag as any)[modifier]
                        const currentWrapperFlagNum = (EventWrapperFlag as any)[modifier]
                        if (!currentFlagNum && !currentWrapperFlagNum) {
                            InvalidEventFlag(modifier, eventName, startSourceIndex, endSourceIndex)
                        }
                        if (currentFlagNum) {
                            // 只有input事件可以使用compose修饰符
                            if (modifier === "compose" && eventName !== "@input") {
                                InvalidComposeModifier(
                                    eventName.slice(1),
                                    startSourceIndex,
                                    endSourceIndex
                                )
                            }

                            // 重复出现的修饰符记录到duplicateModifiers
                            if (existringModifiers.has(modifier)) {
                                duplicateModifiers.add(modifier)
                            } else {
                                eventModifierArr.push(modifier)
                                existringModifiers.add(modifier)
                                eventFlag |= currentFlagNum || 0
                            }
                        } else if (currentWrapperFlagNum) {
                            // 只有keyup、keydown和keypress事件可以使用普通按键修饰符
                            if (
                                keyRelatedEventModifiers.has(modifier) &&
                                !/^key(?:up|down|press)$/.test(eventName)
                            ) {
                                InvalidKeyRelatedModifier(
                                    modifier,
                                    eventName,
                                    startSourceIndex,
                                    endSourceIndex
                                )
                            } else if (keyRelatedEventModifiers.has(modifier)) {
                                // 如果已经存在了普通按键修饰符，则先清空它们，并在之后重新追加
                                // 预期：多个普通按键修饰符时，最后一个优先级最高并应用最后一个修饰符
                                //
                                // 注意：此处代码的正确性依赖EventWrapperFlag中flag的声明顺序，
                                // 即：(1 << 9) - 1 === (1 << 0) | (1 << 1) | ... | (1 << 8)
                                if (existingKeyRelatedModifiers.length > 0) {
                                    eventWrapperFlag &= ~((1 << 9) - 1)
                                }
                                if (!existringModifiers.has(modifier)) {
                                    existingKeyRelatedModifiers.push(modifier)
                                }
                            }

                            // 重复出现的修饰符记录到duplicateModifiers
                            if (existringModifiers.has(modifier)) {
                                duplicateModifiers.add(modifier)
                            } else {
                                existringModifiers.add(modifier)
                                eventWrapperFlag |= currentWrapperFlagNum || 0
                            }
                        }
                    })

                    // 普通按键修饰符存在多个时发出警告
                    if (existingKeyRelatedModifiers.length > 1) {
                        ConflictNormalKeyEventModifier(
                            existingKeyRelatedModifiers,
                            modifierStartSourceIndex,
                            key.loc.end.index
                        )
                    }

                    // 存在重复的修饰符时发出警告
                    if (duplicateModifiers.size > 0) {
                        DuplicateEventModifiers(
                            Array.from(duplicateModifiers),
                            eventName,
                            modifierStartSourceIndex,
                            key.loc.end.index
                        )
                    }

                    // 将最后一个普通按键修饰符记录到eventWrapperModifierArr
                    if (existingKeyRelatedModifiers.length > 0) {
                        eventWrapperModifierArr.push(lastElem(existingKeyRelatedModifiers))
                    }
                }
            }

            if (isComponent) {
                attributeStu.push(
                    concatStrAndTIR(
                        stringify(eventName) + ", ",
                        transAttrValue(trimedValue, {
                            isComponentEvent: true
                        }),
                        ""
                    )
                )
            } else {
                const tir = transAttrValue(trimedValue, {
                    eventWrapper: {
                        flag: eventWrapperFlag,
                        modifiers: eventWrapperModifierArr
                    }
                })
                if (eventFlag === 0) {
                    flagComment = "no flag"
                } else {
                    flagComment = eventModifierArr.join(", ")
                }

                const prefix = `${stringify(eventName)}, `
                const postfix = `, /* ${flagComment} */ ${eventFlag}`
                eventStu.push(concatStrAndTIR(prefix, tir, postfix))
            }
        } else if ((isSlot && pureKey === "name") || (parentIsComponent && pureKey === "slot")) {
            // slot标签的name属性（或组件的直接子元素的slot属性）不能是动态的，也不能是引用的，且不能为空
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
                    const sqi = value.loc.start.index - 1
                    const qc = inputDescriptor.source[sqi]
                    slotAttributeInfo[1] = sqi
                    slotOfAnyTag = stringify(rv)
                    slotAttributeInfo[0] = `${qc}${attr.value.raw}${qc}`
                    markPositionFlag(sqi, "isSlotAttrStartQuote")
                    markPositionFlag(value.loc.end.index + 1, "isSlotAttrEndQuote")
                }
            }
        } else {
            if (isCheckMode && isSlot) {
                // 如果存在name属性，在这之前它一定被记录到了nameOfSlotTag中，因为普通
                // name属性的优先级高于其他属性（参考当前文件顶部对amp变量描述的注释内容）
                const slotName = JSON.parse(nameOfSlotTag || '"default"')

                // slotInfo是一个存储了某个slot标签上除name属性外其他属性的值部分的源码索引它们
                // 需要通过ts语言服务将属性组合为一个对象并获取对象类型来完善插槽属性类型检查
                // 通过inputDescriptor.interIndexMap[源码索引]能访问中间代码中对应字符的索引
                let target = inputDescriptor.slotInfo[slotName]?.properties
                if (isUndefined(target)) {
                    inputDescriptor.slotInfo[slotName] = {
                        properties: (target = []),
                        landingIndex: node.loc.start.index
                    }
                }
                target.push([pureKey, isInterpolation ? trimedValueStartSourceIndex : -1])
            }

            const tir = isInterpolation ? transAttrValue(trimedValue) : stringify(rv)
            attributeStu.push(concatStrAndTIR(`${stringify(pureKey)}, `, tir, ""))
        }
    })

    // 设置aliasModule调用结构
    if (aliasArgs.length) {
        directiveStu.push([getAlias("aliasModule"), ...aliasArgs])
    }

    // 检查模式时，需要为组件标签生成实例化的相关中间代码（指令的中间代码与其他标签处理一致），
    // 组件的普通属性/动态属性/事件、引用属性、slots会被组合为组件构造函数的三个对象类型参数
    if (isCheckMode && isComponent) {
        const attrRecords = Array.from({ length: 2 }, () => {
            return [] as [string, number, number][]
        })

        preProcessedAttr.forEach(attr => {
            const rk = attr.key.raw
            const rv = attr.value.raw
            if (rk.startsWith("#")) {
                return
            }

            const target = attrRecords[+rk.startsWith("&")]
            const camelKey = kebab2Camel(rk.replace(/^[!@&]/, ""))
            const isValidIdentifier = validIdentifierNameRE.test(camelKey)
            const objectKey = isValidIdentifier ? camelKey : normalStringify(camelKey)
            target.push(
                [`${objectKey}:`, attr.key.loc.start.index, attr.key.loc.end.index],
                [`${rv}`, attr.value.loc.start.index, attr.value.loc.end.index]
            )
        })

        interCodeSnippets.push([-1, "new "])
        recordInterWithSpecificRange(`${node.componentTag}(`, ...stnr)

        for (const target of attrRecords) {
            interCodeSnippets.push([stnr[0], "{"])
            target.forEach((item, index) => {
                const isValue = index % 2 !== 0
                const isLast = index === target.length - 1
                item[0] += isValue && !isLast ? "," : ""
                recordInterWithSpecificRange(...item)
                if (isLast) {
                    interCodeSnippets.push([stnr[1], ","])
                }
            })
            interCodeSnippets.push([-2, "}"], [stnr[1], ","])
        }
        interCodeSnippets.push([-2, `0${isTS ? " as any" : ""});`])
    }

    // slot节点未使用slot指令时记录slot属性相关的中间代码片段
    if (isCheckMode && parentIsComponent && !hasSlotDirective) {
        recoedSlotAttributeInterSnippet()
    }

    return {
        eventStu,
        directiveStu,
        attributeStu,
        insertNullNum,
        slotOfAnyTag,
        nameOfSlotTag,
        createTemplate,
        awaitExpression,
        contextBlockCount,
        continueInfo: {
            re: continueRE,
            arg: continueArg,
            by: shouldContinueDirective
        }
    }
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

    const ret: FilteredTemplateAttribute[] = []
    const isComponentOrSlot = isComponent || tag === "slot"
    const existingItem = new Map<string, TemplateAttribute[]>()

    for (let i = 0; i < attributes.length; i++) {
        const curAttr = attributes[i]
        const { key, value, loc } = curAttr
        const isSpecial = /^[!@#&]/.test(key.raw)
        const isDirective = key.raw.startsWith("#")

        // 组件或slot标签时需要将串型属性名转换为驼峰格式
        if (isComponentOrSlot) {
            key.raw = kebab2Camel(key.raw)
        }

        // 当属性为动态/引用属性、事件且无值时使用key的名称作为值，需确保不存在插值块
        if (isSpecial && !isDirective && value.loc.start.index === -1) {
            value.raw = key.raw.slice(1)
        }

        const [rk, rv] = [key.raw, value.raw]
        const isClass = /^[!&]?class/.test(rk)
        const pureKey = !isSpecial ? rk : rk.slice(1)
        const isDynamicOrReference = /^[!&]/.test(rk)

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
            if (mustPassValueDirectives.has(pureKey) && !rv) {
                NoValueForRequiredValueAttribute(rk, loc)
            }
        }

        // 特殊情况：非组件标签上的class属性，动态和非动态class均可出现一次，rk相同且重复出现才会报错
        // 注意：这里需要单独检测是否是引用传递的class属性，若是则报错，因为多个class会被合并成一个动态
        // class属性（!class)，合并之后的属性名并不会导致分析属性时检测到普通标签上使用引用属性的错误
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
                normalClassIndex = target.push(curAttr) - 1
            } else {
                if (rk.startsWith("&")) {
                    CanNotAcceptRefAttribute(pureKey, tag, loc)
                }
                dynamicClassIndex = target.push(curAttr) - 1
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

        // 根据传入的chars数组检查是否存在重复属性名，当char+pureKey===rk时表示这是当前rk
        // 第一次出现，无需检查，其他情况则只要char+pureKey在existingItem中存在则视为重复
        const checkDuplicateWithChars = (chars: string[]) => {
            return chars.some(char => {
                if (char + pureKey === rk || !existingItem.has(char + pureKey)) {
                    return false
                }
                return DuplicateAttributeKey(tag, char + pureKey, rk, loc), true
            })
        }

        // 组件上的普通属性、动态属性、事件名三者之间的任意两两组合视为重复
        if (isComponent && checkDuplicateWithChars(["", "!", "&"])) continue

        // textarea标签的value或input标签的value/checked属性：
        // 普通属性、动态属性、引用属性三者之间的任意两两组合视为重复
        if (
            (tag === "textarea" && pureKey === "value") ||
            (tag === "input" && /^value|checked$/.test(pureKey))
        ) {
            if (checkDuplicateWithChars(["", "!", "&"])) continue
        }

        existingItem.set(rk, [curAttr])
    }

    // 整理属性值的格式：这里的规则是将普通或动态class合并为一个动态的class属性值并放在一个数组中，
    // 此格式是runtime需要的唯一格式，这里无需关注转换后的属性（包括键值）位置信息（均与第一项保持一致），
    // 因为如果它包含动态class就会在调用transformInterpolation时传入positionMap，并根据这个位置映射
    // 来记录需要生成sourcemap的位置，而如果它不包含动态class，则整个表达式都不会被记录sourcemap位置信息
    // 注意：检查模式下无需上述处理，且会忽略普通class属性（另外纯字符串部分无需在检查模式下生成中间代码表示）
    existingItem.forEach((attrItems, attrKey) => {
        if (isComponentOrSlot || inputDescriptor.options.check || attrKey !== "!class") {
            return attrItems.forEach(item => ret.push(item))
        }

        const rawValues = attrItems.map((item, index) => {
            if (index !== normalClassIndex) {
                return item.value.raw
            }
            return normalStringify(item.value.raw)
        })
        const transformedValue = rawValues.join(", ")

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

        ret.push({
            loc: attrItems[0].loc,
            key: {
                raw: attrKey,
                loc: attrItems[0].key.loc
            },
            value: {
                raw: `[${transformedValue}]`,
                loc: attrItems[0].value.loc
            },
            positionMap: positionMap.length ? positionMap : undefined
        })
    })

    // 属性排序，具体排序规则参考apm变量定义处的注释
    return ret.sort((a, b) => {
        const [ak, bk] = [a.key.raw, b.key.raw]
        return (apm[bk] || 0) - (apm[ak] || 0)
    })
}

// 将解构模式转换为单行模式，并记录开始和结束位置的映射(同TransformInterpolationRet中的mapping)
// 这里的映射的四个元素分别代表：源码索引、转换后的表达式列、源码行、源码列（转换后的表达式行都为1，无需记录）
// 此方法主要用来将for/then/catch/slot指令中的结构模式转换成单行模式并记录位置映射，方便之后生成sourcemap信息
function makeDestructuringPatternSignleLine(
    pattern: string,
    startSourceIndex: number
): TransformInterpolationRet {
    const { positions } = inputDescriptor
    const endSourceIndex = startSourceIndex + pattern.length
    const [startLoc, endLoc] = [positions[startSourceIndex], positions[endSourceIndex]]
    const transformedPattern = pattern.replace(new RegExp(expressionReplaceWithSpaceRE, "g"), " ")
    return {
        transformedExp: transformedPattern,
        mappings: [
            [startSourceIndex, 0, startLoc.line, startLoc.column],
            [endSourceIndex, transformedPattern.length, endLoc.line, endLoc.column]
        ]
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
    tir: TransformInterpolationRet,
    aliasArgs: TransformInterpolationRet[],
    context: TemplateContext,
    isForDirective: boolean,
    baseCtxIndex: number
) {
    const identifiers = new Set<string>()
    const patternStr = isString(tir) ? tir : tir.transformedExp
    const declarationSourceCode = `const ${patternStr}={}`

    const ast = parse(declarationSourceCode)?.body[0]
    const patternNode = (ast as any).declarations[0].id as EsPattern

    // 检查模式下的遇到babel内部错误时，直接返回
    if (isUndefined(ast)) return

    if (!isForDirective) {
        getIdentifiersFromPattern(patternNode).forEach(from => {
            identifiers.add(from)
            extendContext(context, from)
        })
    } else {
        getIdentifiersFromPatternWithPath(declarationSourceCode, patternNode).forEach(
            (path, from) => {
                identifiers.add(from)
                extendContext(context, from, path)
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

/**
 * @description: 此方法用来扩展context，将指令（for、then、catch、slot）产生的上下文标识符记录到context中
 *
 * @param from 表示源码标识符名称（transformInterpolation方法中会将此标识符替换为上下文访问表达式）
 *
 * @param pathTo 是一个可选的字符串，未传入（为undefined）时扩展的context.map元素中path属性为空字符串，
 * path属性为访问当前上下文标识符时需要使用的路径，它应该和num属性配合使用，拼接为类似于ctx(num).path的格式，
 * 关于为什么要这样处理：可跳转到 recordDestructuringIdentifiers 方法定义处对 isForDirective 参数的注释
 */
function extendContext(context: TemplateContext, from: string, pathTo?: string) {
    const num = context.count++
    context.map.set(from, {
        num,
        path: pathTo || ""
    })
}
