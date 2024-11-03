import type {
    TemplateNode,
    TemplateContext,
    TemplateAttribute,
    ValueWithLocation,
    AttributeAnalysisRet,
    TransformInterpolationRet,
    FilteredTemplateAttribute,
    TransformInterpolationOptionalParam
} from "../types"
import type { EsPattern } from "../estree/types"
import type { AnyObject, FixedArray, StartBracket } from "../../util/types"

import {
    stringify,
    findOutOfSC,
    normalStringify,
    findEndCurlyBracket
} from "../../util/compiler/strings"
import {
    InvalidEventFlag,
    InvalidEventForSlot,
    DuplicateEventModifiers,
    InvalidComposeModifier,
    InvalidKeyRelatedModifier,
    InvalidEventFlagForComponent,
    ConflictNormalKeyEventModifier
} from "../message/warn"
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
    BadValueForRefAttr,
    CouldNotPassRefValue,
    DirectivesCantCoexist,
    MissingStartDirective,
    DuplicateAttributeKey,
    DynamicNameAttrForSlot,
    NameAttrForSlotIsEmpty,
    BasSlotDirectiveCarrier,
    RefuseReferenceAttribute,
    NoBaseValueForForDirective,
    NoForDirectiveCtxNameSpeciffied,
    NoValueForRequiredValueAttribute,
    UseKeyDirectiveWithoutForDirective
} from "../message/error"
import { getAlias } from "./alias"
import { is } from "../estree/assert"
import { lastElem } from "../../util/shared/sundry"
import { getLocByIndex } from "../../util/compiler/locations"
import { inputDescriptor, interCodeSnippets } from "../state"
import { transformInterpolation } from "../transformer/interpolation"
import { EventListenerFlag, EventWrapperFlag } from "../../util/shared/flag"
import { isEmptyString, isNull, isString, isUndefined } from "../../util/shared/assert"
import { checkIdentifierName, confirmAlias, kebab2Camel } from "../../util/compiler/sundry"
import { couldUseRefTags, keyRelatedEventModifiers, mustPassValueDirectives } from "../constants"
import { DestructuringContextRE, expressionReplaceWithSpaceRE, SlotDirectiveRE } from "../regular"

// dpm means Directives Priority Map
// dpm是一个映射对象，它存储了一些指令名的优先等级（一个数字），数字越大，优先级越高，在调用preProcessAttr方法时，
// 指令将会被按照他们的优先级进行排序，其他指令（包括动态/引用属性、事件）优先级默认为0（优先级低于dpm数组中的所有指令）
// 指令优先级：#slot > #await > #catch > #then > #if > #elif > #else > #for > #key > 其他指令、属性、事件
const dpm = ["key", "for", "else", "elif", "if", "then", "catch", "await"].reduce(
    (pre, cur, index) => {
        return { ...pre, [`#${cur}`]: index + 1 }
    },
    {} as AnyObject
)

export function analyzeAttribute(
    node: TemplateNode,
    isComponent: boolean,
    parentIsComponent: boolean,
    attrs: TemplateAttribute[],
    context: TemplateContext,
    continueByDirective?: string,
    awaitExpression?: [number, string]
): AttributeAnalysisRet {
    let pureKey: string
    let insertNullNum = 0
    let withAwait = false
    let createTemplate = false
    let createdContextCount = 0
    let forModuleFuncIndex = -1
    let continueRE: RegExp | null = null
    let shouldContinueDirective: string | undefined
    let continueArg: TransformInterpolationRet | undefined
    let slotOfAnyTag: ValueWithLocation<string> | null = null
    let nameOfSlotTag: ValueWithLocation<string> | null = null

    const { tag } = node
    const isSlot = tag === "slot"
    const eventStu: TransformInterpolationRet[] = []
    const aliasArgs: TransformInterpolationRet[] = []
    const attributeStu: TransformInterpolationRet[] = []
    const directiveStu: TransformInterpolationRet[][] = []
    const preProcessedAttr = preProcessAttr(attrs, tag, isComponent)

    // 修改continueRE变量，这里需要检测此变量是否已经被赋值，若已被赋值则不能覆盖原来的值，避免
    // 低优先级的指令高优先级指令，例如await指令的后续指令正则表达式可能会被if/elif指令覆盖
    const setContinueInfo = (v: RegExp | null) => {
        shouldContinueDirective = isNull((continueRE = v)) ? undefined : pureKey
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
            if (inputDescriptor.options.check) {
                recordInterExp(startSourceIndex, exp), ""
            }
            return transformInterpolation(exp, startSourceIndex, context, "directive", option)
        }

        // 转换标签属性值
        const transAttrValue = (exp: string, option?: TransformInterpolationOptionalParam) => {
            if (inputDescriptor.options.check) {
                recordInterExp(trimedValueStartSourceIndex, exp), ""
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
                if (inputDescriptor.options.check) {
                    interCodeSnippets.push([-1, "{"]), createdContextCount++
                }
                if (!DestructuringContextRE.test(trimedValue)) {
                    if (inputDescriptor.options.check) {
                        interCodeSnippets.push(
                            [-1, "const "],
                            [trimedValueStartSourceIndex, trimedValue]
                        )
                    } else {
                        checkIdentifierName(
                            trimedValue,
                            getLocByIndex(
                                trimedValueStartSourceIndex,
                                trimedValueStartSourceIndex + trimedValue.length
                            )
                        )
                        extendContext(context, trimedValue)
                    }
                } else {
                    const tip = makeDestructuringPatternSignleLine(
                        trimedValue,
                        trimedValueStartSourceIndex
                    )
                    recordDestructuringIdentifiers(tip, aliasArgs, context, false, context.count++)
                }
                if (inputDescriptor.options.check) {
                    if (pureKey === "slot") {
                    } else if (pureKey === "then") {
                        // prettier-ignore
                        interCodeSnippets.push(
                            [-2, "=__c__.SatisfyResolve("],
                            awaitExpression!,
                            [-2, ");"]
                        )
                    } else {
                        interCodeSnippets.push([-2, "= 0 as any;"])
                    }
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

            // 检查模式下不会调用transformInterpolation方法，这里需要检查一下引用传递的值是否合法
            if (inputDescriptor.options.check) {
                const ast = (parse(trimedValue)?.body[0] as any)?.expression
                if (ast && !(is(ast, "Identifier") || is(ast, "MemberExpression"))) {
                    BadValueForRefAttr(value.raw, value.loc)
                }
            }

            // 检查普通标签上的引用属性是否合法，对于input元素（非radio/checkbox）、textarea元素或
            // select元素都只能接受&value，input（radio/checkbox）只能接受&checked，option元素
            // 只能接受&selected。另外：若input元素的具有动态type属性，它将不能接受任何引用属性
            if (!isComponent) {
                let tagForErr = tag
                let attrIsNotAllowed = false
                let attrsForErr: string[] = []

                if (!couldUseRefTags.has(tag)) {
                    CouldNotPassRefValue(pureKey, tag, attr.loc)
                }

                // 检查普通标签上的引用属性是否合法，对于input元素（非radio/checkbox）、textarea元素或
                // select元素都只能接受&value，input（radio/checkbox）只能接受&checked，option元素
                // 只能接受&selected。另外：若input元素的具有动态type属性，它将不能接受任何引用属性
                if (tag === "input") {
                    const [typeAttr] = preProcessedAttr.filter(attr => {
                        return /^[!@#&]?type$/.test(attr.key.raw)
                    })
                    if (typeAttr?.key.raw.startsWith("!")) {
                        RefuseReferenceAttribute("input", "type", attr.loc)
                    }

                    const typeValueRaw = typeAttr?.value.raw
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
                    const [multipleAttr] = preProcessedAttr.filter(attr => {
                        return attr.key.raw.endsWith("multiple")
                    })
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
            if (!inputDescriptor.options.check) {
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
                if (!isComponent) {
                    if (pureKey === "checked") {
                        interCodeSnippets.push(
                            [-1, `__c__.SatisfyBoolean(`],
                            [trimedValueStartSourceIndex, trimedValue],
                            [-1, ");"]
                        )
                    } else if (pureKey === "group") {
                        const valueAttr = preProcessedAttr.filter(attr => {
                            return /^[!@#&]?value/.test(attr.key.raw)
                        })?.[0]
                        interCodeSnippets.push(
                            [-1, `__c__.SatisfyRefGroup(`],
                            [trimedValueStartSourceIndex, trimedValue],
                            [-2, ","]
                        )

                        if (/[!@#&]/.test(valueAttr.key.raw[0])) {
                            interCodeSnippets.push([
                                valueAttr.value.loc.start.index,
                                valueAttr.value.raw
                            ])
                            interCodeSnippets.push([-2, ");"])
                        } else {
                            interCodeSnippets.push([-1, "`"])
                            interCodeSnippets.push([
                                valueAttr.value.loc.start.index,
                                valueAttr.value.raw
                            ])
                            interCodeSnippets.push([-2, "`);"])
                        }
                    }
                }

                // 非普通标签上的group引用属性时，检查给定值是否是左值（可赋值的目标）
                if (isComponent || pureKey !== "group") {
                    interCodeSnippets.push(
                        [trimedValueStartSourceIndex, trimedValue],
                        [-2, `=0${inputDescriptor.script.isTS ? " as any" : ""};`]
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

                    if (!forBaseValue) {
                        NoBaseValueForForDirective(
                            trimedValueStartSourceIndex,
                            trimedValueStartSourceIndex + trimedValue.length
                        )
                        break
                    }
                    createdContextCount += Number(hasContextIdentifier)

                    if (!inputDescriptor.options.check) {
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
                                [-1, "__c__.GetKVPair("],
                                [trimedValueStartSourceIndex, trimedValue],
                                [-2, ");"]
                            )
                        } else {
                            interCodeSnippets.push(
                                [-1, "{const ["],
                                [trimedValueStartSourceIndex, contextStr],
                                [-2, "]=__c__.GetKVPair("],
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
                        if (inputDescriptor.options.check) {
                            interCodeSnippets.push(
                                [-1, "__c__.SatisfyPromise("],
                                [trimedValueStartSourceIndex, trimedValue],
                                [-2, ");"]
                            )
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

                default:
                    // 不是slot指令时报错（未知指令）
                    if (!SlotDirectiveRE.test(pureKey)) {
                        UnkonwDirective(rk, key.loc)
                    }

                    // 父元素非组件，不能使用slot指令
                    if (!parentIsComponent) {
                        BasSlotDirectiveCarrier(key.loc)
                    }

                    recordAliasIdentifiers()
                //
                // switch code block end here
                //
            }
        } else if (isEvent) {
            if (isSlot) {
                InvalidEventForSlot(rk, attr.loc)
            } else {
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
                                InvalidEventFlag(
                                    modifier,
                                    eventName,
                                    startSourceIndex,
                                    endSourceIndex
                                )
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
            }
        } else if ((isSlot && pureKey === "name") || (parentIsComponent && pureKey === "slot")) {
            // slot标签的name属性（或组件的直接子元素的slot属性）不能是动态的，也不能是引用的，且不能为空
            // 这里只需检测name或slot属性是不是动态类型即可，因为引用类型属性的处理不会经过这里的代码块
            const attrWithLocationStu = {
                loc: attr.loc,
                value: stringify(rv)
            }
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
            }
            if (isSlotAttribute) {
                slotOfAnyTag = attrWithLocationStu
            } else {
                nameOfSlotTag = attrWithLocationStu
            }
        } else {
            const tir = isInterpolation ? transAttrValue(trimedValue) : stringify(rv)
            attributeStu.push(concatStrAndTIR(`${stringify(pureKey)}, `, tir, ""))
        }
    })

    // 设置aliasModule调用结构
    if (aliasArgs.length) {
        directiveStu.push([getAlias("aliasModule"), ...aliasArgs])
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
        createdContextCount,
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
        const currentAttribute = attributes[i]
        const { key, value, loc } = currentAttribute
        const [rk] = [key.raw, value.raw]

        const isNative = /^[^@!#&]/.test(rk)
        const isDynamicOrReference = /^[!&]/.test(rk)
        const isEvent = rk.startsWith("@")
        const isDirective = rk.startsWith("#")
        const isClass = /^[!&]?class/.test(rk)
        const pureKey = isNative ? rk : rk.slice(1)

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
            if (mustPassValueDirectives.has(pureKey) && !value.raw) {
                NoValueForRequiredValueAttribute(rk, loc)
            }
        }

        // 检查是否存在重复的属性，检查规则如下：
        // 1. 任何编译器指令都不能在同一个标签上重复出现
        // 2. class外的属性名不能重复：name、!name、&name、@name均视为相同名称（其中事件的名称只有在组件
        // 标签上不能与其他属性的名称重复，如果是普通标签，则只要不存在相同的时间名称就不会报错
        // 3. 普通标签上可以同时存在普通class和动态class，但均只能同时存在一个，但如果当前标签是组件或slot，
        // 那么class属性不能重复，只能存在一种（普通值或动态值）（普通标签上不能使用引用的class属性）
        if (isDirective || !isClass || isComponentOrSlot) {
            if (isDirective || (!isComponent && isEvent)) {
                if (existingItem.has(rk)) {
                    DuplicateAttributeKey(tag, rk, rk, loc)
                }
            } else {
                ;["", "!", "@", "&"].forEach(char => {
                    if (existingItem.has(char + pureKey)) {
                        DuplicateAttributeKey(tag, char + pureKey, rk, loc)
                    }
                })
            }
            existingItem.set(rk, [currentAttribute])
            continue
        }

        // 上述检查的第三种情况：非组件标签上的class属性，动态和非动态class均可出现一次，重复出现将报错
        // 注意：这里需要单独检测是否是引用传递的class属性，若是则报错，因为多个class会被合并成一个动态
        // class属性（!class)，合并之后的属性名并不会导致属性处理中检测到普通标签上使用引用属性的错误
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
                normalClassIndex = target.push(currentAttribute) - 1
            } else {
                if (rk.startsWith("&")) {
                    CouldNotPassRefValue(pureKey, tag, loc)
                }
                dynamicClassIndex = target.push(currentAttribute) - 1
            }
        }
    }

    // 整理属性值的格式：这里的规则是将普通或动态class合并为一个动态的class属性值并放在一个数组中，
    // 此格式是runtime需要的唯一格式，这里无需关注转换后的属性（包括键值）位置信息（均与第一项保持一致），
    // 因为如果它包含动态class就会在调用transformInterpolation时传入positionMap，并根据这个位置映射来
    // 记录需要生成sourcemap的位置，而如果它不包含动态class，则整个表达式都不会被记录sourcemap位置信息
    // 注意：检查模式下无需上述处理，且会忽略普通class属性（纯字符串部分无需再检查模式下生成中间代码表示）
    existingItem.forEach((attrItems, attrKey) => {
        if (isComponentOrSlot || inputDescriptor.options.check || attrKey !== "!class") {
            attrItems.forEach(item => {
                item.key.raw !== "class" && ret.push(item)
            })
        } else {
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
        }
    })

    // 属性排序，具体排序规则参考dpm变量定义处的注释，这里单独处理的slot指令的排序（优先级最高）
    return ret.sort((a, b) => {
        const [ak, bk] = [a.key.raw, b.key.raw]
        const akIsSlot = ak.startsWith("#slot")
        if (akIsSlot || bk.startsWith("#slot")) {
            return akIsSlot ? -1 : 1
        }
        return (dpm[bk] || 0) - (dpm[ak] || 0)
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

// 生成验证使用group引用属性时，value的值是否满足数组或集合值类型的中间代码
function refGroupValueSatisfiedCodeGen(rv: string) {
    return `
        (
            ${rv} instanceof Array
            ? ${rv}.push
            : ${rv} instanceof Set
            ? ${rv}.add
            : null
        )?.(
    `.replace(/\s+/g, " ")
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

// 记录表达式中间代码片段，它们在中间代码中会被放在一个数组中
function recordInterExp(startSourceIndex: number, exp: string) {
    if (!isEmptyString(exp)) {
        interCodeSnippets.push([-1, "["], [startSourceIndex, exp], [-2, "];"])
    }
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
