import type {
    TemplateContext,
    TemplateAttribute,
    AttributeAnalysisRet,
    TransformExpressionRet,
    FilteredTemplateAttribute,
    TransformExpressionOptionalParam
} from "../types"
import type { EsPattern } from "../estree/types"
import type { VariableDeclaration } from "@babel/types"

import {
    InvalidEventFlag,
    InvalidEventForSlot,
    DuplicateAttributeKey,
    InvalidEventFlagForComponent
} from "../message/warn"
import {
    kebab2Camel,
    findOutOfSC,
    normalStringify,
    checkIdentifierName
} from "../../util/compiler/sundry"
import {
    parse,
    getIdentifiersFromPattern,
    getIdentifiersFromPatternWithPath
} from "../../util/compiler/estree"
import {
    EmptyAttributeName,
    InvalidSlotAttribute,
    CouldNotPassRefValue,
    SlotAttributeIsEmpty,
    DirectivesCantCoexist,
    MissingStartDirective,
    InvalidSlotNameAttribute,
    SlotNameAttributeIsEmpty,
    NoValueForRequiredValueAttribute,
    GeneralTagJustAcceptAutoAsReference,
    UsedKeyDirectiveWithoutForDirective,
    ReferenceValueCantBeUsedWithDynamicType
} from "../message/error"
import { getAlias } from "./alias"
import { stringify } from "../../util/compiler/state"
import { transformExpression } from "../transformer/expression"
import { couldUseRefTags, mustPassValueDirectives } from "../constants"
import { EventListenerFlag, EventWrapperFlag, isString, isUndefined } from "../../util/shared"
import { compilerOptions } from "../configuration"

export function analyzeAttribute(
    tag: string,
    isComponent: boolean,
    parentIsComponent: boolean,
    attrs: TemplateAttribute[],
    context: TemplateContext,
    continueByDirective: string | undefined,
    awaitContextStartIndex: number | undefined
): AttributeAnalysisRet {
    let slot = ""
    let slotName = ""
    let pureKey: string
    let insertNullNum = 0
    let withAwait = false
    let createTemplate = false
    let forModuleFuncIndex = -1
    let continueArg: string | undefined
    let continueRE: RegExp | null = null
    let continuedDirective: string | undefined

    const isSlot = tag === "slot"
    const aliasArgs: string[] = []
    const directiveStu: string[][] = []
    const eventStu: TransformExpressionRet[] = []
    const attributeStu: TransformExpressionRet[] = []
    const filteredAttrs = filterDuplicateAttr(attrs, tag, isComponent)

    filteredAttrs.forEach(attr => {
        const { key, value } = attr
        const [rk, rv] = [key.raw, value.raw]

        const trimedValue = rv.trim()
        const isRef = rk.startsWith("&")
        const isEvent = rk.startsWith("@")
        const isDynamic = rk.startsWith("!")
        const isDirective = rk.startsWith("#")
        const teOptionalParam = { usedAsSetter: true }
        const valueStartIndex = attr.value.loc.start.index
        const isExpression = isEvent || isDynamic || isDirective || isRef

        // 转换标签指令，此时返回值一定是string，因为传入的startIndex为-1
        const transDirective = (exp: string, option?: TransformExpressionOptionalParam) => {
            return transformExpression(exp, -1, context, "directive", option) as string
        }

        // 转换标签属性值
        const transAttrValue = (exp: string, option?: TransformExpressionOptionalParam) => {
            if (!option) {
                option = {
                    positionMap: attr.positionMap
                }
            } else {
                option.positionMap = attr.positionMap
            }

            const res = transformExpression(exp, valueStartIndex, context, "attribute", option)
            return isString(res) ? res : res.transformedExp
        }

        // pureKey代表纯键值，即去掉!@#&前缀的属性名
        // 如果当前标签是组件，还需要驼峰属性名转换为串型
        pureKey = isExpression ? rk.slice(1) : rk
        if (isComponent) {
            pureKey = kebab2Camel(pureKey)
        }

        // 处理引用值，如果是组件，就把引用传递放在eventStu的位置
        if (isRef) {
            if (pureKey === "slot") {
                InvalidSlotAttribute(2)
            }
            if (isSlot && pureKey === "name") {
                InvalidSlotNameAttribute(2)
            }
            if (!couldUseRefTags.has(tag) && !isComponent) {
                CouldNotPassRefValue(pureKey, tag)
            }

            const teWithGetter = transAttrValue(rv)
            const teWithoutGetter = transAttrValue(rv, teOptionalParam)
            if (isComponent) {
                // 调试模式下修改引用值是应该将原始标识符的值一起修改
                let setterTarget = teWithoutGetter
                if (compilerOptions.debugeMode) {
                    setterTarget += ` = ${value.raw}`
                }
                eventStu.push(stringify(pureKey))
                eventStu.push(`[${teWithGetter}, v => (${setterTarget} = v)]`)
            } else {
                let listenEventName = "input"
                let reactiveProperty = "value"
                const [typeAttr] = filteredAttrs.filter(attr => {
                    return attr.key.raw.endsWith("type")
                })
                if (pureKey !== "auto") {
                    GeneralTagJustAcceptAutoAsReference(tag)
                }
                if (typeAttr?.key.raw.startsWith("!")) {
                    ReferenceValueCantBeUsedWithDynamicType(tag)
                }

                const isSelectTag = tag === "select"
                const isSpecialTypeForInput = /^"(?:checkbox|radio)"$/.test(typeAttr?.value.raw)
                if (isSelectTag) {
                    listenEventName = "change"
                }
                if (tag === "input" && isSpecialTypeForInput) {
                    listenEventName = "change"
                    reactiveProperty = "checked"
                }

                const setterStr = `v => (${teWithoutGetter} = v)`
                const listenEventNameStr = stringify(listenEventName)
                const withReferenceFuncName = getAlias("withReference")
                attributeStu.push(stringify(reactiveProperty), teWithGetter)

                // prettier-ignore
                // 这里在eventStu中多添加了一个空字符串，因为在transformTemplate中会将奇数项认为是事件名称，
                // 所有的奇数项都需要确认其中的字符串字面量变量是否需要保留，所以这里通过这种方式来保持一致性
                eventStu.push("", `...${withReferenceFuncName}(${listenEventNameStr}, ${setterStr})`)
            }
        } else if (isDirective) {
            switch (pureKey) {
                case "for":
                    const preContextCount = context.count || 0
                    const inKeywordIndex = findOutOfSC(trimedValue, / in /)
                    const hasContextIdentifier = inKeywordIndex !== -1
                    const contextStr = trimedValue.slice(0, inKeywordIndex).trim()
                    const forBasedValue = hasContextIdentifier
                        ? trimedValue.slice(inKeywordIndex + 4).trim()
                        : trimedValue
                    const transformedForBaseValue = transDirective(forBasedValue)

                    // 设置context.count并记录forModule在directiveStu中的索引
                    context.count = preContextCount + 2
                    forModuleFuncIndex = directiveStu.length

                    // 处理上下文
                    if (hasContextIdentifier) {
                        let item: string, index: string
                        const itemWithDestructuring = /^[{\[]/.test(contextStr)
                        const indexWithDestructuring = /[}\]]$/.test(contextStr)

                        if (!itemWithDestructuring && !indexWithDestructuring) {
                            ;[item, index] = contextStr.split(",").map(s => s.trim())
                        } else {
                            item = findForItemDestructuringStr(contextStr)
                            index = contextStr.slice(item.length).replace(/ *, */, "")
                        }

                        if (!indexWithDestructuring) {
                            checkIdentifierName(index)
                            extendContext(context, index, preContextCount)
                        } else {
                            recordAliasIdentifiers(index, context, aliasArgs, 0)
                        }
                        if (!itemWithDestructuring) {
                            checkIdentifierName(item)
                            extendContext(context, item, preContextCount + 1)
                        } else {
                            recordAliasIdentifiers(item, context, aliasArgs, 1)
                        }
                    }

                    directiveStu.push([getAlias("forModule"), transformedForBaseValue])
                    break

                case "key":
                    if (forModuleFuncIndex === -1) {
                        UsedKeyDirectiveWithoutForDirective()
                    } else {
                        const teOptionalParam = { isKeyDirective: true }
                        const transformedExp = transDirective(rv, teOptionalParam)
                        directiveStu[forModuleFuncIndex][0] = getAlias("keyedForModule")
                        directiveStu[forModuleFuncIndex].push(transformedExp)
                    }
                    break

                case "if":
                case "elif":
                case "else":
                    if (pureKey === "else") {
                        continueArg = "1"
                    } else {
                        const transformedExp = transDirective(rv)
                        if (pureKey === "elif") {
                            continueArg = transformedExp
                        } else {
                            createTemplate = true
                            directiveStu.push([getAlias("ifModule"), transformedExp])
                        }
                        continueRE = /^#(?:elif|else)$/
                    }
                    if (pureKey !== "if" && isUndefined(continueByDirective)) {
                        MissingStartDirective(rk, "#if")
                    }
                    continuedDirective = pureKey
                    break

                case "then":
                case "catch":
                case "await":
                    if (pureKey === "await") {
                        const transformedExp = transDirective(rv)
                        directiveStu.push([getAlias("awaitModule"), transformedExp])
                        continueRE = /^#(?:then|catch)$/
                        createTemplate = true
                        withAwait = true
                    } else {
                        const withDestructuring = /^[{\[]/.test(rv)
                        if (isUndefined(continueByDirective) && !withAwait) {
                            MissingStartDirective(rk, "#await")
                        }
                        context.count++

                        if (isUndefined(awaitContextStartIndex)) {
                            awaitContextStartIndex = context.count
                        }
                        if (!withDestructuring) {
                            checkIdentifierName(rv)
                            extendContext(context, rv, awaitContextStartIndex)
                        } else {
                            recordAliasIdentifiers(rv, context, aliasArgs, awaitContextStartIndex)
                        }
                        if (withAwait) {
                            if (pureKey === "catch") {
                                insertNullNum = 2
                                continueRE = null
                            } else {
                                insertNullNum = 1
                            }
                        }
                        if (pureKey === "then") {
                            continueRE = /^#catch$/
                        }
                    }
                    if (continueByDirective === "await" && pureKey === "catch") {
                        insertNullNum = 1
                    }
                    continuedDirective = pureKey
                    break
            }
        } else if (isEvent) {
            if (isSlot) {
                InvalidEventForSlot(rk)
            } else {
                let eventFlag = 0
                let eventName = pureKey
                let eventWrapperFlag = 0
                const flagIndex = pureKey.indexOf("|")
                if (flagIndex !== -1) {
                    if (isComponent) {
                        const flagStr = pureKey.slice(flagIndex + 1)
                        InvalidEventFlagForComponent(flagStr)
                    } else {
                        const flagStr = pureKey.slice(flagIndex)
                        const flagArr = flagStr.split("|").slice(1)
                        flagArr.forEach(key => {
                            const currentFlagNum = (EventListenerFlag as any)[key]
                            const currentWrapperFlagNum = (EventWrapperFlag as any)[key]
                            if (!currentFlagNum && !currentWrapperFlagNum) {
                                InvalidEventFlag(key, eventName)
                            }
                            if (currentFlagNum) {
                                eventFlag |= currentFlagNum || 0
                            } else if (currentWrapperFlagNum) {
                                eventWrapperFlag |= currentWrapperFlagNum || 0
                            }
                        })
                    }
                    eventName = pureKey.slice(0, flagIndex)
                }

                if (isComponent) {
                    const transformedExp = transAttrValue(rv, {
                        isComponentEvent: true
                    })
                    attributeStu.push(stringify(eventName), transformedExp)
                } else {
                    const transformedExp = transAttrValue(rv, {
                        eventWrapperFlag
                    })
                    eventStu.push(stringify(eventName), `${transformedExp}, ${eventFlag}`)
                }
            }
        } else {
            if (parentIsComponent && pureKey === "slot") {
                if (!isDynamic) {
                    if (rv !== '""') {
                        slot = rv
                    } else {
                        SlotAttributeIsEmpty()
                    }
                } else {
                    InvalidSlotAttribute(1)
                }
            } else if (isSlot && pureKey === "name") {
                if (!isDynamic) {
                    if (rv !== '""') {
                        slotName = rv
                    } else {
                        SlotNameAttributeIsEmpty()
                    }
                } else {
                    InvalidSlotNameAttribute(1)
                }
            } else {
                attributeStu.push(stringify(pureKey))
                if (isExpression) {
                    attributeStu.push(transAttrValue(rv))
                } else {
                    attributeStu.push(normalStringify(rv))
                }
            }
        }
    })

    // 设置aliasModule调用结构
    if (aliasArgs.length) {
        directiveStu.push([getAlias("aliasModule"), ...aliasArgs])
    }

    return {
        slot,
        slotName,
        eventStu,
        directiveStu,
        attributeStu,
        continueRE,
        continueArg,
        insertNullNum,
        createTemplate,
        continuedDirective,
        awaitContextStartIndex
    }
}

// 该方法的主要用途是过滤重复的属性，此外方法还有以下功能：
// 1. 检查无效的属性、指令和事件名称（只有关键字符!@#&的情况）
// 1. 检查缺失值的指令、缺失值的动态属性及引用属性
// 2. 将多个class属性合并为一个动态class属性
// 3. 检查是否使用了非法的指令搭配组合
export function filterDuplicateAttr(
    attributes: TemplateAttribute[],
    tag: string,
    isComponent: boolean
) {
    let dynamicClassIndex = -1
    let normalClassIndex: number = -1
    let ifRelatedDirectivesCoexistState = ""
    let awiatRelatedDirectivesCoexistState = ""

    const ret: FilteredTemplateAttribute[] = []
    const isComponentOrSlot = isComponent || tag === "slot"
    const existingItem = new Map<string, TemplateAttribute[]>()

    for (let i = 0; i < attributes.length; i++) {
        const { key, value, loc } = attributes[i]
        const [rk, rv] = [key.raw, value.raw]

        const isNative = /^[^@!#&]/.test(rk)
        const isDynamic = /^[!&]/.test(rk)
        const isEvent = rk.startsWith("@")
        const isDirective = rk.startsWith("#")
        const isClass = /^[!&]?class/.test(rk)
        const pureKey = isNative ? rk : rk.slice(1)

        if (isNative) {
            value.raw = normalStringify(rv)
        }

        // 检查没有名称的动态或引用属性、指令和事件
        if (isEvent || isDynamic || isDirective) {
            if (!pureKey) {
                EmptyAttributeName(rk[0])
            }
        }

        if (isEvent) {
            if (value) {
                ret.push({ loc, key, value })
            } else {
                NoValueForRequiredValueAttribute(rk, 2)
            }
            continue
        }

        // 1. 检查需要传递值的指令是否未传递
        // 2. 检查是否使用了不能同时存在的指令搭配[if elif else]和[then catch]
        if (isDirective) {
            if (mustPassValueDirectives.has(pureKey) && !value) {
                NoValueForRequiredValueAttribute(rk, 1)
            }
            if (/^#(?:if|elif|else)$/.test(rk)) {
                if (!ifRelatedDirectivesCoexistState) {
                    ifRelatedDirectivesCoexistState = rk
                } else {
                    DirectivesCantCoexist([ifRelatedDirectivesCoexistState, rk])
                }
            }
            if (/^#(?:then|catch)$/.test(rk)) {
                if (!awiatRelatedDirectivesCoexistState) {
                    awiatRelatedDirectivesCoexistState = rk
                } else {
                    DirectivesCantCoexist([awiatRelatedDirectivesCoexistState, rk])
                }
            }
        }

        // 检查动态或引用的属性值是否未传递
        if (isDynamic && !value) {
            NoValueForRequiredValueAttribute(rk, rk.startsWith("!") ? 3 : 4)
        }

        // 检查是否存在重复的属性，检查规则：普通标签上可以同时存在普通class和动态class，
        // 但均只能同时存在一个，存在多个时后者覆盖前者，组件或slot上的class属性只能有一个
        if (isDirective || !isClass || isComponentOrSlot) {
            if (
                existingItem.has(pureKey) ||
                existingItem.has("!" + pureKey) ||
                existingItem.has("&" + pureKey)
            ) {
                existingItem.delete(pureKey)
                if (!isDirective) {
                    existingItem.delete("!" + pureKey)
                    existingItem.delete("&" + pureKey)
                }
                DuplicateAttributeKey(tag, pureKey, isDirective)
            }
            existingItem.set(rk, [attributes[i]])
            continue
        }

        if (isClass && !isComponentOrSlot) {
            if (!existingItem.has("!class")) {
                existingItem.set("!class", [])
            }
            const target = existingItem.get("!class")!
            if (isDynamic) {
                if (rk.startsWith("&")) {
                    CouldNotPassRefValue(pureKey, tag)
                }
                if (dynamicClassIndex !== -1) {
                    target[dynamicClassIndex] = attributes[i]
                    DuplicateAttributeKey(tag, rk, false)
                } else {
                    dynamicClassIndex = target.push(attributes[i]) - 1
                }
            } else {
                if (normalClassIndex !== -1) {
                    target[normalClassIndex] = attributes[i]
                    DuplicateAttributeKey(tag, pureKey, isDirective)
                } else {
                    normalClassIndex = target.push(attributes[i]) - 1
                }
            }
        }
    }

    // 整理属性值的格式：这里的规则是将普通或动态class合并为一个动态的class属性值并放在一个数组中，
    // 此格式是runtime需要的唯一格式，这里无需关注转换后的属性（包括键值）位置信息（均与第一项保持一致），
    // 因为如果它包含动态class就会在调用transformExpression时传入positionMap，并根据这个位置映射来
    // 记录需要生成sourcemap的位置，而如果它不包含动态class，则整个表达式都不会被记录sourcemap位置信息
    existingItem.forEach((attrItems, attrKey) => {
        if (isComponentOrSlot || attrKey !== "!class") {
            ret.push(attrItems[0])
        } else {
            const rawValues = attrItems.map(item => {
                return item.value.raw
            })
            const transformedValue = rawValues.join(", ")

            // positionMap用来存储位置映射信息，只有动态class值的部分会存在位置映射（动态值字符索引 -> 源码字符索引），
            // 在transformExpression方法中如果传入了位置映射信息，只有在表达式索引存在源码位置映射时才生成sourcemap
            // 例如，模板语法：class="aaa" !class="aaa"，转换后的class值为["aaa", aaa]，动态class在转换后的数组
            // 的第二个元素，所以positionMap只有下标为8，9，10的元素存在源码位置，访问其他下标都将得到undefined
            const positionMap: number[] = []

            if (compilerOptions.generateSourcemap) {
                // 存在动态class时，记录转换后class值的位置映射（class值字符索引 -> 源码字符索引）
                // dynamicStartIndex表示动态class值在组合转换后的值中开始字符的索引，将从这一索引开始记录位置映射
                let dynamicStartIndex = 1
                if (dynamicClassIndex === 1) {
                    // 这里的+2为拼接是添加的 逗号空格 的固定长度
                    dynamicStartIndex += attrItems[0].value.raw.length + 2
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

    // 将过滤后的属性数组按照指定优先级排序并返回，指令的优先级大于其他属性，
    // 而各指令间的优先级和o数组的声明顺序相反，即：#await > #if > #elif > #else > #for > #key
    return ret.sort((a, b) => {
        //prettier-ignore
        const o = [
            "key",
            "for",
            "else",
            "elif",
            "if",
            "then",
            "catch",
            "await"
        ]
        const [ak, bk] = [a.key.raw, b.key.raw]
        const oa = o.reduce((p, c, i) => {
            return { ...p, [`#${c}`]: i + 1 }
        }, {} as any)
        return (oa[bk] || 0) - (oa[ak] || 0)
    })
}

// 从for指令产生上下文的字符中分离出item的部分
export function findForItemDestructuringStr(s: string) {
    let sc = 0
    let res = ""

    if (!/^[{[]/.test(s)) {
        const commaIndex = s.indexOf(",")
        return s.slice(0, commaIndex)
    }

    const charMap = {
        "{": "}",
        "[": "]"
    }
    const startChar = s[0]
    const slash = startChar === "[" ? "\\" : ""
    const endChar = charMap[startChar as "{" | "["]
    const restr = `[${slash}${startChar}${slash}${endChar}]`
    do {
        const index = findOutOfSC(s, new RegExp(restr))
        const isStartChar = s[index] === startChar
        if (index === -1) {
            break
        }
        res += s.slice(0, index + 1)
        sc += isStartChar ? 1 : -1
        s = s.slice(index + 1)
    } while (sc)
    return res
}

// 设置解构产生的上下文
function recordAliasIdentifiers(
    source: string,
    context: TemplateContext,
    aliasArgs: string[],
    baseCtxIndex?: number
) {
    const shouldRecordPath = !isUndefined(baseCtxIndex)
    const ast = parse((source = `const ${source}={}`)).body[0]
    const declarators = (ast as VariableDeclaration).declarations
    declarators.forEach(declarator => {
        const identifiers: string[] = []
        const baseValue = `ctx(${baseCtxIndex})`
        const pattern = declarator.id as EsPattern
        const patternSource = source.slice(pattern.start!, pattern.end!)
        if (!shouldRecordPath) {
            getIdentifiersFromPattern(pattern).forEach(from => {
                identifiers.push(from)
                extendContext(context, from, -1)
            })
        } else {
            getIdentifiersFromPatternWithPath(source, pattern).forEach((path, from) => {
                identifiers.push(from)
                extendContext(context, from, -1, `${baseValue}${path}`)
            })
        }
        aliasArgs.push(`ctx => ${baseValue}`, `(${patternSource}) => [${identifiers.join(", ")}]`)
    })
}

// 扩展context
function extendContext(context: TemplateContext, from: string, index: number, pathTo?: string) {
    const useCount = index === -1
    const to = `ctx(${useCount ? context.count++ : index})`
    if (!pathTo) {
        context.map.set(from, { to })
    } else {
        context.map.set(from, { to, pto: pathTo })
    }
}
