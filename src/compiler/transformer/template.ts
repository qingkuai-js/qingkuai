import type { NumNum } from "../../util/types"
import type { ValueOrValueArr } from "../../runtime/types"
import type { TemplateAnalysisRet, TransformInterpolationRet } from "../types"

import { getAlias } from "../analyzer/alias"
import { recordMapping } from "../sourcemap"
import { indent } from "../../util/compiler/sundry"
import { isArray, isNull, isString } from "../../util/shared/assert"
import { lastElem, replaceEachItems } from "../../util/shared/sundry"

const transformTemplateFlag = {
    useBracketWrap: 1 << 0,
    parentUseLineBreak: 1 << 1,
    hasNextChild: 1 << 2
}

// 从templateAnalysisRet生成模版结构js代码
export function transformTemplate(
    analysisRet: (TemplateAnalysisRet | null)[],
    generatingPosition: NumNum,
    indentN = 2,
    flag = 1
) {
    const transformedArr: string[] = []
    const hasNextChild = vf(flag, "hasNextChild")
    const useBracketWrap = vf(flag, "useBracketWrap")
    const useLineBreak = shouldUseLineBreak(analysisRet, true)
    const parentUseLineBreak = vf(flag, "parentUseLineBreak") || useLineBreak

    // 判断当前处理目标是否用作组件的slot，只需判断analysisRet[0]即可，因为用作slot时
    // useBracket属性会被设置为true，而在调用chunkChildren之后他就会被划分为一个单独的块
    // 注意：只有children中的节点才有可能是组件slot，qk文件中的一级节点不属于任何组件的子节点
    const slotAttrValue = analysisRet[0]?.aar?.slotOfAnyTag

    // generatingPosition表示当前生成代码的位置，访问它得到的就是下一个字符在转换结果中的
    // 行、列，当生成结果需要使用中括号包裹且需要换行时，将生成代码位置的行（下标为0的元素）+1
    // 注意：若上述条件成立，且slotAttrValue有值（需用方括号包裹），应该在将生成代码位置的行+1
    if (useBracketWrap && useLineBreak) {
        generatingPosition[0]++
        if (slotAttrValue) {
            generatingPosition[0]++
        }
    }

    // 添加字符串到转换结果，期间同步更新转换结果的位置信息
    const pushTransformedArr = (...tirs: TransformInterpolationRet[]) => {
        for (const tir of tirs) {
            const tirIsString = isString(tir)
            const [currentLine, currentColumn] = generatingPosition
            const str = tirIsString ? tir : tir.transformedExp
            if (str !== "\n") {
                generatingPosition[1] += str.length
            } else {
                replaceEachItems(generatingPosition, [currentLine + 1, 0])
            }
            if (!tirIsString) {
                tir.mappings.forEach(item => {
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

        const { isSpread } = item
        const hasAar = !isNull(item.aar)
        const hasChild = childrenLen! > 0
        const withEventStu = hasAar && item.aar!.eventStu.length > 0
        const elementUseLineBreak = shouldUseLineBreak(item, hasChild)
        const isContinued = hasAar && Boolean(item.aar!.continueInfo?.re)
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
        const addAttributeOrEventStu = (tirs: TransformInterpolationRet[]) => {
            const tirsLen = tirs.length
            if (tirsLen === 0) {
                return pushTransformedArr(getAlias("nil"))
            }

            let charCount = 0
            const indentStr = indent(n + 2)
            for (const tir of tirs) {
                charCount += getLengthOfTER(tir)
                if (charCount > 80) {
                    break
                }
            }
            pushTransformedArr("[")

            if (charCount <= 80) {
                tirs.forEach((tir, index) => {
                    pushTransformedArr(tir)
                    if (index !== tirsLen - 1) {
                        pushTransformedArr(", ")
                    }
                })
            } else {
                tirs.forEach((tir, index) => {
                    if (index === 0) {
                        pushTransformedArr("\n")
                    }
                    pushTransformedArr(indentStr, tir)

                    if (index !== tirsLen - 1) {
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
        if (!isSpread) {
            pushTransformedArr("[")
            if (elementUseLineBreak) {
                pushTransformedArr("\n", indent(n + 1))
            }
        }

        // 添加tag、content、attribute和event结构
        if (!isSpread) {
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
            const test = chunkChildren(item.children)
            test.forEach(chunk => {
                if (chunk.useBracket) {
                    flag |= transformTemplateFlag.useBracketWrap
                } else {
                    flag &= ~transformTemplateFlag.useBracketWrap
                }
                if (chunk.isLast) {
                    flag &= ~transformTemplateFlag.hasNextChild
                } else {
                    flag |= transformTemplateFlag.hasNextChild
                }
                if (elementUseLineBreak) {
                    flag |= transformTemplateFlag.parentUseLineBreak
                } else {
                    flag &= ~transformTemplateFlag.parentUseLineBreak
                }

                const childIndentN = +(useLineBreak && !isSpread) + n
                const transformedChild = transformTemplate(
                    chunk.tars,
                    generatingPosition,
                    childIndentN,
                    flag
                )
                if (!chunk.useBracket && !chunk.isLast) {
                    pushTransformedArr(", ")
                    if (useLineBreak) {
                        pushTransformedArr("\n", indent(n))
                    }
                }
                pushTransformedArr(transformedChild)
            })
        }

        // 添加当前TemplateStructure的结束字符
        if (!isSpread) {
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

    const retLineBreak = useLineBreak ? "\n" : ""
    const retIndentStr = useLineBreak ? indent(indentN) : ""
    const retLineBreakByParent = parentUseLineBreak ? "\n" : ""
    const retIndentStrByParent = parentUseLineBreak ? indent(indentN) : ""
    const retPostfix = hasNextChild ? `, ${retLineBreakByParent}${retIndentStrByParent}` : ""

    // 更新生成代码位置
    if (useLineBreak) {
        generatingPosition[0]++
    }
    if (hasNextChild && parentUseLineBreak) {
        generatingPosition[0]++
        generatingPosition[1] = retIndentStrByParent.length
    }

    const retNextIndentStr = useLineBreak ? indent(indentN + 1) : ""
    const slotAttrValueStr = slotAttrValue
        ? `${retLineBreak}${retNextIndentStr}${slotAttrValue}, `
        : ""
    return `[${slotAttrValueStr}${retLineBreak}${transformedStr}${retLineBreak}${retIndentStr}]${retPostfix}`
}

// 获取表达式转换结果（TransformInterpolationRet）的程度
function getLengthOfTER(tir: TransformInterpolationRet) {
    if (isString(tir)) {
        return tir.length
    }
    return tir.transformedExp.length
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
        const slotAttrValueLen = aar?.slotOfAnyTag?.length || 0
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
            if (isNull(aar)) {
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

// 将TemplateAnalysisRet["children"]中的元素按照是否使用中括号包裹进行拆分：若需要使用
// 中括号包裹（useBracket为true）则单独作为一个块，连续的无需使用中括号包裹的元素作为一个块
function chunkChildren(children: TemplateAnalysisRet["children"]) {
    const len = children.length
    const chunks: {
        isLast: boolean
        useBracket: boolean
        tars: (TemplateAnalysisRet | null)[]
    }[] = []

    if (children.length === 0) {
        return chunks
    }

    for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const isLast = i === len - 1
        if (child.useBracket) {
            chunks.push({
                isLast,
                useBracket: true,
                tars: [child.tar]
            })
        } else {
            const preChunkItem = lastElem(chunks)
            if (chunks.length === 0 || preChunkItem.useBracket) {
                chunks.push({
                    isLast,
                    useBracket: false,
                    tars: [child.tar]
                })
            } else {
                preChunkItem.isLast = isLast
                preChunkItem.tars.push(child.tar)
            }
        }
    }

    return chunks
}

// 判断函数参数是否需要中括号包裹
function shouldArgUseBracket(funcName: string) {
    return funcName === getAlias("ifModule", false) || funcName === getAlias("aliasModule", false)
}
