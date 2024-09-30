import type { FixedArray } from "../../util/types"
import type { ValueOrValueArr } from "../../runtime/types"
import type { TemplateAnalysisRet, TransformInterpolationRet } from "../types"

import { templateTag } from "../regular"
import { getAlias } from "../analyzer/alias"
import { recordMapping } from "../sourcemap"
import { indent } from "../../util/compiler/state"
import { findOutOfSC } from "../../util/compiler/strings"
import { isArray, isNull, isString, isUndefined } from "../../util/shared/assert"
import { inputDescriptor, stringConstants, stringConstantsSourceMap } from "../state"

const transformTemplateFlag = {
    useBracketWrap: 1 << 0,
    parentUseLineBreak: 1 << 1,
    notOverAfterEndBracket: 1 << 2
}

// 从templateAnalysisRet生成模版结构js代码
export function transformTemplate(
    analysisRet: (TemplateAnalysisRet | null)[],
    startLine: number,
    indentN = 2,
    flag = 1
) {
    // 确定字符串字面量变量是保留还是还原
    analysisRet?.forEach(item => {
        if (isNull(item)) {
            return
        }
        if (item.tag) {
            item.tag = confirmStringConstants(item.tag)
        }
        if (item.content) {
            item.content = confirmStringConstants(item.content)
        }
        if (item.aar?.slotOfAnyTag) {
            const sav = item.aar.slotOfAnyTag.value
            item.aar.slotOfAnyTag.value = confirmStringConstants(sav)
        }
        for (let i = 0; true; i++) {
            const estu = item.aar?.eventStu
            const astu = item.aar?.attributeStu
            if (!astu?.[i] && !estu?.[i]) {
                break
            }
            if (!isUndefined(astu?.[i])) {
                astu[i] = confirmStringConstants(astu[i])
            }
            if (!isUndefined(estu?.[i])) {
                estu[i] = confirmStringConstants(estu[i])
            }
        }
    })

    const transformedArr: string[] = []
    const useBracketWrap = vf(flag, "useBracketWrap")
    const useLineBreak = shouldUseLineBreak(analysisRet, true)
    const notOverAfterEndBracket = vf(flag, "notOverAfterEndBracket")
    const parentUseLineBreak = vf(flag, "parentUseLineBreak") || useLineBreak

    // 转换结果的位置信息，访问它得到的就是下一个字符在转换结果中的行、列
    let currentPosition!: FixedArray<number, 2>
    if (useBracketWrap && useLineBreak) {
        startLine++
    }
    currentPosition = [startLine, 0]

    // 添加字符串到转换结果，期间同步更新转换结果的位置信息
    const pushTransformedArr = (...ters: TransformInterpolationRet[]) => {
        for (const ter of ters) {
            const terIsString = isString(ter)
            const [currentLine, currentColumn] = currentPosition
            const str = terIsString ? ter : ter.transformedExp
            if (str !== "\n") {
                currentPosition[1] += str.length
            } else {
                currentPosition = [currentLine + 1, 0]
            }
            if (!terIsString) {
                ter.mappings.forEach(item => {
                    const sourceLine = item[2] - 1
                    const generatedColumn = item[1] + currentColumn
                    recordMapping(currentLine, generatedColumn, sourceLine, item[3], item[0], true)
                })
            }
            transformedArr.push(str)
        }
    }

    analysisRet.forEach((item, index) => {
        let n = indentN

        const isFirst = index === 0
        const childrenLen = item?.children.length
        const isLast = index === analysisRet.length - 1
        if (useBracketWrap) {
            n++
        }
        if (isNull(item)) {
            pushTransformedArr(getAlias("nil"), ",", "\n", indent(n))
            return
        }

        const hasAar = !isNull(item.aar)
        const hasChild = childrenLen! > 0
        const isTemplate = templateTag.test(item.tag)
        const isContinued = hasAar && !isNull(item.aar!.continueRE)
        const withEventStu = hasAar && item.aar!.eventStu.length > 0
        const elementUseLineBreak = shouldUseLineBreak(item, hasChild)
        const withDirectiveStu = hasAar && item.aar!.directiveStu.length > 0
        const withAttributeStu = hasAar && item.aar!.attributeStu.length > 0
        const withAttributeOrEventStu = withAttributeStu || withEventStu || hasChild
        const elementUseIndent = isFirst && !withDirectiveStu && useBracketWrap && useLineBreak

        // 添加tag、content、attribute、event结构间的链接字符串（逗号，换行符）
        const addTemplateStuJoinStr = (hasNext: boolean) => {
            if (hasNext) {
                pushTransformedArr(",")
                if (!elementUseLineBreak) {
                    pushTransformedArr(" ")
                } else {
                    pushTransformedArr("\n", indent(n + 1))
                }
            }
        }

        // 添加attribute或event结构（这里包括单独的换行判断，因为这两个结构都是数组形式）
        const addAttributeOrEventStu = (ters: TransformInterpolationRet[]) => {
            const tersLen = ters.length
            if (tersLen === 0) {
                return pushTransformedArr(getAlias("nil"))
            }

            let charCount = 0
            const indentStr = indent(n + 2)
            for (const ter of ters) {
                charCount += getLengthOfTER(ter)
                if (charCount > 80) {
                    break
                }
            }
            pushTransformedArr("[")

            if (charCount <= 80) {
                ters.forEach((ter, index) => {
                    pushTransformedArr(ter)
                    if (index !== tersLen - 1) {
                        pushTransformedArr(", ")
                    }
                })
            } else {
                ters.forEach((ter, index) => {
                    if (index === 0) {
                        pushTransformedArr("\n")
                    }
                    pushTransformedArr(indentStr, ter)

                    if (index !== tersLen - 1) {
                        pushTransformedArr(",", "\n")
                    } else {
                        pushTransformedArr("\n", indent(n + 1))
                    }
                })
            }
            pushTransformedArr("]")
        }

        // 添加指令函数调用结构
        if (withDirectiveStu) {
            const funcCount = item.aar!.directiveStu.length
            const funcArr = item.aar!.directiveStu.reduce((pre, cur, funcIndex) => {
                const argArr: TransformInterpolationRet[] = []
                const isAliasModuleFunc = shouldArgUseBracket(cur[0] as string)
                if (isAliasModuleFunc) {
                    argArr.push(`${indent(n++ + 1)}[`, "\n")
                }
                cur.slice(1).forEach((arg, argIndex) => {
                    const isLastArg = argIndex === cur.length - 2
                    const useEndComma = isAliasModuleFunc && isLastArg
                    argArr.push(`${indent(n + 1)}`, arg, `${useEndComma ? "" : ","}`, "\n")
                })
                if (isAliasModuleFunc) {
                    argArr.push(`${indent(n--)}],`, "\n")
                }
                if (funcIndex !== funcCount - 1) {
                    argArr.push(indent(n + 1))
                }
                return n++, pre.concat([cur[0], "(", "\n"], argArr)
            }, [])
            if (isFirst && useBracketWrap) {
                pushTransformedArr(indent(n - funcCount))
            }
            pushTransformedArr(...funcArr, indent(n))
        }

        // 添加TemplateStructure开始的前缀
        if (elementUseIndent) {
            pushTransformedArr(indent(n))
        }
        if (!isTemplate) {
            pushTransformedArr("[")
            if (elementUseLineBreak) {
                pushTransformedArr("\n", indent(n + 1))
            }
        }

        // 添加tag、content、attribute、event和children结构
        if (!isTemplate) {
            pushTransformedArr(item.tag)
            addTemplateStuJoinStr(true)

            pushTransformedArr(item.content)
            addTemplateStuJoinStr(withAttributeOrEventStu)

            if (withAttributeOrEventStu) {
                const hasEvent = withEventStu || hasChild
                const eventStu = item.aar?.eventStu || []
                const hasAttribute = withAttributeStu || hasEvent
                const attributeStu = item.aar?.attributeStu || []
                if (hasAttribute) {
                    addAttributeOrEventStu(attributeStu)
                    addTemplateStuJoinStr(hasEvent)
                }
                if (hasEvent) {
                    addAttributeOrEventStu(eventStu)
                    addTemplateStuJoinStr(hasChild)
                }
            }
        }

        // 添加children调用结构
        if (childrenLen) {
            let waitForChunkEndIndex = 0
            let chunkChildren: (TemplateAnalysisRet | null)[] = []
            for (let i = 0; i < childrenLen; i++) {
                const child = item.children[i]
                const childIndentN = +(useLineBreak && !isTemplate) + n
                if (child.useBracket) {
                    chunkChildren = [child.tar]
                } else {
                    const nextChild = item.children[i + 1]
                    if (nextChild && !nextChild.useBracket) {
                        continue
                    }

                    const start = waitForChunkEndIndex
                    const end = (waitForChunkEndIndex = i + 1)
                    const partOfChildren = item.children.slice(start, end)
                    chunkChildren = partOfChildren.map(child => child.tar)
                }
                if (child.useBracket) {
                    flag |= transformTemplateFlag.useBracketWrap
                } else {
                    flag &= ~transformTemplateFlag.useBracketWrap
                }
                if (i !== item.children.length - 1) {
                    flag |= transformTemplateFlag.notOverAfterEndBracket
                } else {
                    flag &= ~transformTemplateFlag.notOverAfterEndBracket
                }
                if (elementUseLineBreak) {
                    flag |= transformTemplateFlag.parentUseLineBreak
                } else {
                    flag &= ~transformTemplateFlag.parentUseLineBreak
                }
                pushTransformedArr(
                    transformTemplate(chunkChildren, currentPosition[0], childIndentN, flag)
                )
            }
        }

        // 添加当前TemplateStructure的结束字符
        if (!isTemplate) {
            if (elementUseLineBreak) {
                pushTransformedArr("\n", indent(n))
            }
            pushTransformedArr("]")
        }

        // 添加函数调用的结束字符
        if (withDirectiveStu) {
            const funcCount = item.aar!.directiveStu.length
            for (let i = 0; i < funcCount; i++) {
                pushTransformedArr("\n", indent(--n), ")")
            }
        }

        // 添加多个TemplateStructure之间的链接字符
        if (!isLast) {
            pushTransformedArr(", ")
            if (parentUseLineBreak || isContinued) {
                pushTransformedArr("\n", indent(n))
            }
        }
    })

    const transformedStr = transformedArr.join("")
    if (!useBracketWrap) {
        return transformedStr
    }

    const retWrap = useLineBreak ? "\n" : ""
    const sav = analysisRet[0]?.aar?.slotOfAnyTag?.value
    const retWrapByParent = parentUseLineBreak ? "\n" : ""
    const retIndentStr = useLineBreak ? indent(indentN) : ""
    const retNextIndentStr = useLineBreak ? indent(indentN + 1) : ""
    const retIndentStrByParent = parentUseLineBreak ? indent(indentN) : ""
    const slotAttrValueStr = sav ? `${retWrap}${retNextIndentStr}${sav}, ` : ""
    return `[${slotAttrValueStr}${retWrap}${transformedStr}${retWrap}${retIndentStr}]${
        notOverAfterEndBracket ? `, ${retWrapByParent}${retIndentStrByParent}` : ""
    }`
}

// 获取表达式转换结果（TransformInterpolationRet）的程度
function getLengthOfTER(ter: TransformInterpolationRet) {
    if (isString(ter)) {
        return ter.length
    }
    return ter.transformedExp.length
}

// 验证falg中是否设置了transformTemplateFlag的指定项
function vf(flag: number, key: keyof typeof transformTemplateFlag) {
    const item = transformTemplateFlag[key]
    return (flag & item) === item
}

// 判断当前模版结构是否需要使用折行（这里只进行粗略判断，避免一行过多内容）
function shouldUseLineBreak(
    analysisRet: ValueOrValueArr<TemplateAnalysisRet | null>,
    checkFuncStu = false,
    state = { count: 0 }
) {
    if (state.count > 60) {
        return true
    }
    if (!isArray(analysisRet)) {
        analysisRet = [analysisRet]
    }

    for (const item of analysisRet) {
        if (isNull(item)) {
            state.count += 2
            continue
        }

        const { aar } = item
        const tagLen = item.tag.length
        const hasChild = item.children.length > 0
        const contentLen = getLengthOfTER(item.content)
        const withFunc = aar && aar.directiveStu.length > 0
        const slotAttrValueLen = aar?.slotOfAnyTag?.value.length || 0
        const keys = ["attributeStu", "eventStu", "directiveStu"] as const
        if (aar) {
            if (checkFuncStu && withFunc) {
                return true
            }
            if (aar.slotOfAnyTag) {
                state.count += slotAttrValueLen + 3
            }
            for (const key of keys) {
                for (let stu of aar[key]) {
                    if (!isArray(stu) || stu.length) {
                        if (isArray(stu)) {
                            for (const item of stu) {
                                state.count += getLengthOfTER(item)
                            }
                        } else {
                            state.count += getLengthOfTER(stu)
                        }
                        if (state.count > 60) {
                            return true
                        }
                    } else {
                        state.count += 4
                    }
                }
            }
        }
        if (hasChild) {
            if (!aar) {
                state.count += 6
            }
            for (const child of item.children) {
                if (shouldUseLineBreak(child.tar, checkFuncStu, state)) {
                    return true
                }
            }
        }
        state.count += tagLen + contentLen + 3
    }

    return state.count > 60
}

// 确定是否使用生成的字符串字面量变量，当其使用次数大于1且其本身长度大于2时就会被保留变量访问，
// 如果搜索到的字符串字面量变量不同时满足以上两个条件，它将被还原为原始的字符串字面量
function confirmStringConstants<T extends TransformInterpolationRet>(ter: T): T {
    const terIsString = isString(ter)
    const transformedArr: string[] = []
    const mappings = terIsString ? [] : ter.mappings
    const code = isString(ter) ? ter : ter.transformedExp
    const mappingOffsets: number[] = Array(terIsString ? 0 : mappings.length).fill(0)

    for (let startIndex = 0, saveAs = ""; true; ) {
        const [matchedIndex, matchedLen] = findOutOfSC(code, /_s\d+_/, startIndex)
        if (matchedIndex === -1) {
            transformedArr.push(code.slice(startIndex))
            break
        }
        transformedArr.push(code.slice(startIndex, matchedIndex))

        const matchedStr = code.slice(matchedIndex, matchedIndex + matchedLen)
        const restoredStrLiteral = stringConstantsSourceMap.get(matchedStr)!
        const currentStringConstant = stringConstants.get(restoredStrLiteral)!
        if (currentStringConstant.count > 1 && restoredStrLiteral.length > 2) {
            const restoreToComment = `/* ${restoredStrLiteral} */ `
            if (!currentStringConstant.using) {
                const resetNumStr = `_s${inputDescriptor.stringConstantCount++}_`
                transformedArr.push((saveAs = restoreToComment + resetNumStr))
                currentStringConstant.value = resetNumStr
                currentStringConstant.using = true
            } else {
                transformedArr.push((saveAs = restoreToComment + currentStringConstant.value))
            }
        } else {
            transformedArr.push((saveAs = restoredStrLiteral))
        }

        // 当string constant被替换编号或还原时，将当前处理位置之后的段的列偏移量记录到
        // mappingOffsets中，mapping中下标为n的项目的列偏移量记录在mappingOffset[n]中
        if (!terIsString) {
            const offset = saveAs.length - matchedStr.length
            for (let i = 0; i < mappings.length; i++) {
                if (mappings[i][1] > matchedIndex) {
                    mappingOffsets[i] += offset
                }
            }
        }

        startIndex = matchedIndex + matchedLen
    }

    // 根据mappingOffsets的记录将mappings中的段进行列偏移
    if (!terIsString) {
        mappings.forEach((item, index) => {
            item[1] += mappingOffsets[index]
        })
    }

    const transformedStr = transformedArr.join("")
    if (terIsString) {
        return transformedStr as any
    }
    return (ter.transformedExp = transformedStr), ter
}

// 判断函数参数是否需要中括号包裹
function shouldArgUseBracket(funcName: string) {
    return funcName === getAlias("ifModule", false) || funcName === getAlias("aliasModule", false)
}
