import type { TemplateAnalysisRet, TransformInterpolationRet } from "../types"

import { findOutOfSC } from "../../util/compiler/strings"
import { isNull, isString, isUndefined } from "../../util/shared/assert"
import { inputDescriptor, stringConstants, stringConstantsSourceMap } from "../state"

// 确定字符串字面量变量是保留还是还原
export function confirmStringConstants(analysisRet: (TemplateAnalysisRet | null)[]) {
    analysisRet?.forEach(item => {
        if (isNull(item)) {
            return
        }
        if (item.tag) {
            item.tag = singleTerConfirm(item.tag)
        }
        if (item.content) {
            item.content = singleTerConfirm(item.content)
        }
        if (item.aar?.slotOfAnyTag) {
            const sav = item.aar.slotOfAnyTag.value
            item.aar.slotOfAnyTag.value = singleTerConfirm(sav)
        }
        for (let i = 0; true; i++) {
            const estu = item.aar?.eventStu
            const astu = item.aar?.attributeStu
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
        confirmStringConstants(item.children.map(child => child.tar))
    })
}

// 确定是否使用生成的字符串字面量变量，当其使用次数大于1且其本身长度大于2时就会被保留变量访问，
// 如果搜索到的字符串字面量变量不同时满足以上两个条件，它将被还原为原始的字符串字面量
function singleTerConfirm<T extends TransformInterpolationRet>(ter: T): T {
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
            const restoreToComment = `/* ${JSON.parse(restoredStrLiteral)} */ `
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
