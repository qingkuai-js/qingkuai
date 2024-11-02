import type { TemplateAnalysisRet, TransformInterpolationRet } from "../types"

import { findOutOfSC } from "../../util/compiler/strings"
import { isNull, isString, isUndefined } from "../../util/shared/assert"
import { inputDescriptor, stringConstants, stringConstantsSourceMap } from "../state"

export function compressCompileSize(tars: (TemplateAnalysisRet | null)[]) {
    ;[confirmBracket, confirmStringConstants].forEach(fn => fn(tars))
}

// 确定字符串字面量变量是保留还是还原(压缩编译体积)
function confirmStringConstants(tars: (TemplateAnalysisRet | null)[]) {
    tars.forEach(tar => {
        if (isNull(tar)) {
            return
        }
        if (tar.tag) {
            tar.tag = singleTerConfirm(tar.tag)
        }
        if (tar.content) {
            tar.content = singleTerConfirm(tar.content)
        }
        if (tar.aar?.slotOfAnyTag) {
            const sav = tar.aar.slotOfAnyTag.value
            tar.aar.slotOfAnyTag.value = singleTerConfirm(sav)
        }
        for (let i = 0; true; i++) {
            const estu = tar.aar?.eventStu
            const astu = tar.aar?.attributeStu
            if (!astu?.[i] && !estu?.[i]) {
                break
            }
            if (!isUndefined(astu?.[i])) {
                astu[i] = singleTerConfirm(astu[i])
            }
            if (!isUndefined(estu?.[i])) {
                estu[i] = singleTerConfirm(estu[i])
            }
        }
        confirmStringConstants(tar.children.map(child => child.tar))
    })
}

// 确定指令模块中的模板结构是否需要保留中括号包裹 (压缩编译体积)
function confirmBracket(tars: (TemplateAnalysisRet | null)[]) {
    tars.forEach(tar => {
        tar?.children.forEach(child => {
            if (child.useBracket) {
                child.useBracket = child.tar?.children.length !== 1
            }
        })
        if (tar?.children?.length) {
            confirmBracket(tar?.children.map(child => child.tar))
        }
    })
}

// 确定是否使用生成的字符串字面量变量，当其使用次数大于1且其本身长度大于2时就会被保留变量访问，
// 如果搜索到的字符串字面量变量不同时满足以上两个条件，它将被还原为原始的字符串字面量
function singleTerConfirm<T extends TransformInterpolationRet>(tir: T): T {
    const tirIsString = isString(tir)
    const transformedArr: string[] = []
    const mappings = tirIsString ? [] : tir.mappings
    const code = isString(tir) ? tir : tir.transformedExp
    const mappingOffsets: number[] = Array(tirIsString ? 0 : mappings.length).fill(0)

    for (let startIndex = 0, saveAs = ""; true; ) {
        const [matchedIndex, matchedLen] = findOutOfSC(code, /__s\d+__/, startIndex)
        if (matchedIndex === -1) {
            transformedArr.push(code.slice(startIndex))
            break
        }
        transformedArr.push(code.slice(startIndex, matchedIndex))

        const matchedStr = code.slice(matchedIndex, matchedIndex + matchedLen)
        const restoredStrLiteral = stringConstantsSourceMap.get(matchedStr)!
        const currentStringConstant = stringConstants.get(restoredStrLiteral)!
        if (currentStringConstant.count > 1 && restoredStrLiteral.length > 2) {
            const restoreToComment = `/* ${JSON.parse(restoredStrLiteral)} */ `
            if (!currentStringConstant.using) {
                const resetNumStr = `__s${inputDescriptor.stringConstantCount++}__`
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
        if (!tirIsString) {
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
    if (!tirIsString) {
        mappings.forEach((item, index) => {
            item[1] += mappingOffsets[index]
        })
    }

    const transformedStr = transformedArr.join("")
    if (tirIsString) {
        return transformedStr as any
    }
    return (tir.transformedExp = transformedStr), tir
}
