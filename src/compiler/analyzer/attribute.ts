import type {
    TemplateContext,
    TemplateAttribute,
    AttributeAnalysisRet,
    TransformInterpolationRet,
    FilteredTemplateAttribute,
    TransformInterpolationOptionalParam
} from "../types"
import type { EsPattern } from "../estree/types"
import type { VariableDeclaration } from "@babel/types"
import type { FixedArray, StartBracket } from "../../util/types"

import {
    InvalidEventFlag,
    InvalidEventForSlot,
    InvalidEventFlagForComponent
} from "../message/warn"
import {
    parse,
    getIdentifiersFromPattern,
    getIdentifiersFromPatternWithPath
} from "../../util/compiler/estree"
import {
    InvalidRefAttr,
    InvalidSlotNameAttribute,
    InvalidSlotAttribute,
    CouldNotPassRefValue,
    SlotAttributeIsEmpty,
    SlotNameAttributeIsEmpty,
    DirectivesCantCoexist,
    MissingStartDirective,
    DuplicateAttributeKey,
    RefuseReferenceAttribute,
    NoForDirectiveCtxNameSpeciffied,
    NoValueForRequiredValueAttribute,
    UseKeyDirectiveWithoutForDirective
} from "../message/error"
import { getAlias } from "./alias"
import { compilerOptions } from "../configuration"
import { DestructuringContextRE } from "../regular"
import { isString, isUndefined } from "../../util/shared/assert"
import { getLocByIndex, stringify } from "../../util/compiler/state"
import { transformInterpolation } from "../transformer/interpolation"
import { couldUseRefTags, mustPassValueDirectives } from "../constants"
import { EventListenerFlag, EventWrapperFlag } from "../../util/shared/flag"
import { kebab2Camel, checkIdentifierName } from "../../util/compiler/sundry"
import { findEndCurlyBracket, findOutOfSC } from "../../util/compiler/strings"

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
    const eventStu: TransformInterpolationRet[] = []
    const attributeStu: TransformInterpolationRet[] = []
    const filteredAttrs = filterDuplicateAttr(attrs, tag, isComponent)

    filteredAttrs.forEach(attr => {
        const { key, value } = attr
        const [rk, rv] = [key.raw, value.raw]

        const keyEndIndex = key.loc.end.index
        const keyStartIndex = key.loc.start.index
        const valueEndIndex = value.loc.end.index
        const valueStartIndex = value.loc.start.index

        const trimedValue = rv.trim()
        const isRef = rk.startsWith("&")
        const isEvent = rk.startsWith("@")
        const isDynamic = rk.startsWith("!")
        const isDirective = rk.startsWith("#")
        const valuePreSpaceLen = /\s*/.exec(rv)![0].length
        const isInterpolation = isEvent || isDynamic || isDirective || isRef

        // 转换标签指令，此时返回值一定是string，因为传入的startIndex为-1
        const transDirective = (exp: string, option?: TransformInterpolationOptionalParam) => {
            return transformInterpolation(exp, -1, context, "directive", option) as string
        }

        // 转换标签属性值
        const transAttrValue = (exp: string, option?: TransformInterpolationOptionalParam) => {
            if (!option) {
                option = {
                    positionMap: attr.positionMap
                }
            } else {
                option.positionMap = attr.positionMap
            }

            return transformInterpolation(exp, valueStartIndex, context, "attribute", option)
        }

        // pureKey为去掉!@#&前缀的属性名，如果是组件，还需将串型命名转换为驼峰命名
        if ((pureKey = rk.slice(+isInterpolation)) && isComponent) {
            pureKey = kebab2Camel(pureKey)
        }

        // slot元素的name属性不能为空也不能是动态属性或引用属性
        if (isSlot && pureKey === "name") {
            if (!(slotName = value.raw)) {
                SlotNameAttributeIsEmpty(key.loc)
            } else if (isDynamic || isRef) {
                InvalidSlotNameAttribute(isDynamic ? "!" : "&", key.loc)
            }
        }

        // 如果父元素是组件，那么当前元素的slot属性不能为空也不能是动态属性或引用属性
        if (parentIsComponent && pureKey === "slot") {
            if ((slot = value.raw) === '""') {
                SlotAttributeIsEmpty(key.loc)
            } else if (isDynamic || isRef) {
                InvalidSlotAttribute(isDynamic ? "!" : "&", key.loc)
            }
        }

        // 处理引用值，如果是组件，就把引用传递放在eventStu的位置
        // 由于select的value属性与普通属性的处理逻辑并不相同（需要判断子option元素的选择情况，
        // 初始化时要异步设置初始值）所以这里将select元素的value属性使用withReference进行处理
        // 但这种情况下最后一个参数（setter)会被传入nil，以打断选项改变时修改响应式值的渠道
        if (isRef || (tag === "select" && pureKey === "value")) {
            const tiGetter = transAttrValue(rv)
            const tiSetter = transAttrValue(rv, { usedAsSetter: true })
            let setter = isString(tiSetter) ? tiSetter : tiSetter.transformedExp
            if (isComponent) {
                const prefix = `${stringify(pureKey)}, [`
                const postfix = `, v => (${setter} = v)]`
                eventStu.push(concatStrAndTER(prefix, tiGetter, postfix))
            } else {
                let tagForErr = tag
                let needSetter = true
                let attrIsNotAllowed = false
                let attrsForErr: string[] = []
                let eventName = tag === "textarea" ? "input" : "change"

                // 只有couldUseRefTags中的普通标签才能使用引用属性
                if (!couldUseRefTags.has(tag)) {
                    CouldNotPassRefValue(pureKey, tag, attr.loc)
                }

                // 检查普通标签上的引用属性是否合法，对于input元素（非radio/checkbox）、textarea元素或
                // select元素都只能接受&value，input（radio/checkbox）只能接受&checked，option元素
                // 只能接受&selected。另外：若input元素的具有动态type属性，它将不能接受任何引用属性
                if (tag === "input") {
                    const [typeAttr] = filteredAttrs.filter(attr => {
                        return attr.key.raw.endsWith("type")
                    })
                    if (typeAttr?.key.raw.startsWith("!")) {
                        RefuseReferenceAttribute("input", "type", attr.loc)
                    }

                    const typeValueRaw = typeAttr?.value.raw
                    if (!/^(?:radio|checkbox)$/.test(typeValueRaw)) {
                        eventName = "input"
                        attrsForErr = ["value"]
                        attrIsNotAllowed = pureKey !== "value"
                    } else {
                        needSetter = pureKey !== "group"
                        attrsForErr = ["checked", "group"]
                        tagForErr = `${tag}[type="${typeValueRaw}"]`
                        attrIsNotAllowed = !/^(?:checked|group)$/.test(pureKey)
                    }
                } else if (tag === "select") {
                    const [multipleAttr] = filteredAttrs.filter(attr => {
                        return attr.key.raw.endsWith("multiple")
                    })
                    if (multipleAttr?.key.raw.startsWith("!")) {
                        RefuseReferenceAttribute("select", "multiple", attr.loc)
                    }
                    attrsForErr = ["value"]
                    needSetter = !multipleAttr
                    attrIsNotAllowed = pureKey !== "value"
                }
                if (attrIsNotAllowed) {
                    InvalidRefAttr(tagForErr, attrsForErr, pureKey)
                }

                // select的value属性（非引用）时setter为null
                if (!isRef) {
                    setter = getAlias("nil")
                } else if (needSetter) {
                    setter = `v => (${setter} = v)`
                }

                const spk = stringify(pureKey)
                const sev = stringify(eventName)
                const funcName = getAlias("withReference")
                const prefix = `...${funcName}(${sev}, ${spk}, `
                eventStu.push(concatStrAndTER(prefix, tiGetter, `, ${setter})`))
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

                    // 处理for指令上下文绑定
                    if (hasContextIdentifier) {
                        let indexPart = ""
                        let itemPart: string
                        let commaFind: FixedArray<number, 2>
                        let errSourceIndex = valueStartIndex

                        // 截取item部分的pattern，并找到commaFind（它是findOutOfSC的返回值，它是一个包含两个
                        // 数字的数组，这两个数字分别代表：逗号所在的索引，匹配字符的长度（逗号及前后空白字符的））
                        if (!DestructuringContextRE.test(contextStr)) {
                            const itemPartEndIndex = findOutOfSC(contextStr, /$|[,\s]/)
                            commaFind = findOutOfSC(contextStr, /\s*,\s*/, itemPartEndIndex)
                            itemPart = contextStr.slice(0, itemPartEndIndex)
                        } else {
                            const startBracket = contextStr[0] as StartBracket
                            const endBracketIndex = findEndCurlyBracket(contextStr, 1, startBracket)
                            commaFind = findOutOfSC(contextStr, /\s*,\s*/, endBracketIndex + 1)
                            itemPart = contextStr.slice(0, endBracketIndex + 1)
                        }

                        // 如果存在逗号时，检查item或index部分的名称是否未指定
                        const [commaIndex, matchedLen] = commaFind
                        if (commaIndex !== -1) {
                            indexPart = contextStr.slice(commaIndex + matchedLen)
                            if (!itemPart || !indexPart) {
                                if (!indexPart) {
                                    errSourceIndex += valuePreSpaceLen + commaIndex + 1
                                }
                                NoForDirectiveCtxNameSpeciffied(
                                    getLocByIndex(errSourceIndex),
                                    itemPart ? "index" : "item"
                                )
                            }
                        }

                        // 将item及index产生的上下文标识符设置到context中（通过extendContext）
                        if (!DestructuringContextRE.test(indexPart)) {
                            if (indexPart) {
                                checkIdentifierName(indexPart)
                                extendContext(context, indexPart, preContextCount)
                            }
                        } else {
                            recordAliasIdentifiers(indexPart, context, aliasArgs, 0)
                        }
                        if (!DestructuringContextRE.test(itemPart)) {
                            if (itemPart) {
                                checkIdentifierName(itemPart)
                                extendContext(context, itemPart, preContextCount + 1)
                            }
                        } else {
                            recordAliasIdentifiers(itemPart, context, aliasArgs, 1)
                        }
                    }

                    // 记录for指令结构（forModule方法调用结构，transformTemplate中使用）
                    directiveStu.push([getAlias("forModule"), transformedForBaseValue])
                    break

                case "key":
                    if (forModuleFuncIndex === -1) {
                        UseKeyDirectiveWithoutForDirective()
                    } else {
                        const transformedExp = transDirective(rv, { isKeyDirective: true })
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
                let flagComment = ""
                let eventName = pureKey
                let eventWrapperFlag = 0

                const flagIndex = pureKey.indexOf("|")
                const flagStr = pureKey.slice(flagIndex + 1)
                const flagArr = flagStr.split("|")

                if (flagIndex !== -1) {
                    if (isComponent) {
                        InvalidEventFlagForComponent(flagStr)
                    } else {
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
                    const ter = transAttrValue(rv, {
                        isComponentEvent: true
                    })
                    attributeStu.push(concatStrAndTER(`${stringify(eventName)}, `, ter, ""))
                } else {
                    const ter = transAttrValue(rv, { eventWrapperFlag })
                    if (eventFlag === 0) {
                        flagComment = "no flag"
                    } else {
                        flagComment = flagArr.join(", ")
                    }

                    const prefix = `${stringify(eventName)}, `
                    const postfix = `, /* ${flagComment} */ ${eventFlag}`
                    eventStu.push(concatStrAndTER(prefix, ter, postfix))
                }
            }
        } else if (!(isSlot && pureKey === "name") && !(parentIsComponent && pureKey === "slot")) {
            const ter = isInterpolation ? transAttrValue(rv) : stringify(rv)
            attributeStu.push(concatStrAndTER(`${stringify(pureKey)}, `, ter, ""))
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
        const currentAttribute = attributes[i]
        const { key, value, loc } = currentAttribute
        const [rk, rv] = [key.raw, value.raw]

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
            // 检查必须传递属性值的属性是否有值
            if (mustPassValueDirectives.has(pureKey) && !value.raw) {
                NoValueForRequiredValueAttribute(key.loc, rk)
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
                    DuplicateAttributeKey(tag, rk, rk)
                }
            } else {
                ;["", "!", "@", "&"].forEach(char => {
                    if (existingItem.has(char + pureKey)) {
                        DuplicateAttributeKey(tag, char + pureKey, rk)
                    }
                })
            }
            existingItem.set(rk, [currentAttribute])
            continue
        }

        // 上述检查的第三种情况：非组件标签上的class属性，动态和非动态class均可出现一次，重复出现将报错
        if (isClass && !isComponentOrSlot) {
            if (!existingItem.has("!class")) {
                existingItem.set("!class", [])
            }

            if (
                (isDynamicOrReference && dynamicClassIndex !== -1) ||
                (!isDynamicOrReference && normalClassIndex !== -1)
            ) {
                DuplicateAttributeKey(tag, rk, rk)
            }

            const target = existingItem.get("!class")!
            if (!isDynamicOrReference) {
                normalClassIndex = target.push(currentAttribute) - 1
            } else {
                if (rk.startsWith("&")) {
                    CouldNotPassRefValue(pureKey, tag)
                }
                dynamicClassIndex = target.push(currentAttribute) - 1
            }
        }
    }

    // 整理属性值的格式：这里的规则是将普通或动态class合并为一个动态的class属性值并放在一个数组中，
    // 此格式是runtime需要的唯一格式，这里无需关注转换后的属性（包括键值）位置信息（均与第一项保持一致），
    // 因为如果它包含动态class就会在调用transformInterpolation时传入positionMap，并根据这个位置映射来
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
            // 在transformInterpolation方法中如果传入了位置映射信息，只有在表达式索引存在源码位置映射时才生成sourcemap
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

// 为transformInterpolation的返回值（转换后的表达式）拼接字符串前缀和后缀，如果返回值中存在mappings
// 还会将mappings中所有段的生成列（下标为1的元素）向右偏移前缀字符串长度的数量以保证正确的源码映射
function concatStrAndTER<T extends TransformInterpolationRet>(
    prefix: string,
    ter: T,
    postfix: string
): T {
    if (isString(ter)) {
        return (prefix + ter + postfix) as any
    }
    ter.mappings.forEach(item => {
        item[1] += prefix.length
    })
    return (ter.transformedExp = prefix + ter.transformedExp + postfix), ter
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
