import type { ASTPosition } from "./types"
import type { SourceMapMappings, SourceMapSegment } from "@jridgewell/sourcemap-codec"

import { compilerOptions } from "./configuration"
import { isUndefined } from "../util/shared/assert"
import { getGeneratedLine } from "./../util/compiler/state"
import { replaceEachItems } from "./../util/shared/sundry"
import { inputDescriptor, sourceMapInfo, tempStoredImportInfos } from "./state"

// 记录一条sourcemap mapping segment
export function recordMapping(
    generatedLine: number,
    generatedColumn: number,
    sourceLine: number,
    sourceColumn: number,
    sourceIndex: number,
    isTemplate = false
) {
    if (!isTemplate) {
        sourceLine = getGeneratedLine(sourceLine)
    } else {
        generatedLine += sourceMapInfo.generatedScriptLineCount
    }

    // 源码行添加源码文件头部注释占用的行数
    if (compilerOptions.debugeMode) {
        sourceLine += 10
    }

    // 初始化新的SoruceMapLine
    initGeneratedLineMapping(generatedLine)

    // segment下标为1的元素本来表示源文件索引，由于QingKuaiCompiler无需设置该元素，所以这里用它
    // 临时存储是否是模板部分的sourcemap段，（0表示不是，1表示是）在最终生成代码阶段偏移segment时，
    // script和template部分的sourcemap segment处理方式不同，最后所有segment的这个元素都会被置为0
    if (!sourceMapInfo.existingSourceIndex.has(sourceIndex)) {
        const targetLine = sourceMapInfo.mappings[generatedLine]
        const segment: SourceMapSegment = [generatedColumn, +isTemplate, sourceLine, sourceColumn]

        // 将新添加的segment放到正确的位置（按照生成行排序）
        targetLine.push(segment)
        for (let i = targetLine.length - 1; i > 0; i--) {
            if (targetLine[i][0] < targetLine[i - 1][0]) {
                ;[targetLine[i], targetLine[i - 1]] = [targetLine[i - 1], targetLine[i]]
            }
        }

        sourceMapInfo.existingSourceIndex.add(sourceIndex)
    }
}

// 按照指定偏移量转换sourcemapMappings
export function offsetSourcemap() {
    let temp: SourceMapMappings = []
    const { indentSpaceCount } = inputDescriptor
    const scriptLoc = inputDescriptor.script.loc
    const scriptStartPosition = scriptLoc.start
    const firstTemplateLine = sourceMapInfo.generatedScriptLineCount

    // 生成代码行偏移（生成代码固定前8行无sourcemap信息）
    for (let i = 0; i < sourceMapInfo.preaddedLineCount + 8; i++) {
        temp.push([])
    }

    // 生成代码行列偏移，根据映射段下标为1的元素（代表是否模板映射段）有以下两种处理情况：
    // 1. 脚本映射段：则将所有生成列偏移一个缩进量，当段处于第一行时还应该额外向右偏移 <lang- ...> 开始标签的长度
    // 2. 模板映射段：只需要让第一行的段偏移sorucemapInfo.columnOffsetOfFirstTemplateLine的值（这个值为固定
    // 两个缩进量 + sts（确认别名后）方法名长度 + 2（函数调用字符 ([ 的固定长度），最后将segment[1]置为0即可
    sourceMapInfo.mappings.forEach((line, index) => {
        if (!sourceMapInfo.removedLine.has(index)) {
            temp.push(line)
        }
        line.forEach(segment => {
            if (index === 1) {
                segment[3]! += scriptStartPosition.column
            }
            if (segment[1] !== 1) {
                segment[0] += indentSpaceCount
            } else {
                if (index === firstTemplateLine) {
                    segment[0] += sourceMapInfo.columnOffsetOfFirstTemplateLine
                }
                segment[1] = 0
            }
        })
    })

    // 将原有的import语句映射信息添加到正确的位置
    // 当语句和 lang- 标签处在同一行时，需要将源码列信息发生偏移(增加标签长度)
    for (let i = 0; i < tempStoredImportInfos.length; i++) {
        const { mappingLine } = tempStoredImportInfos[i]
        mappingLine.forEach(segment => {
            if (segment[2] === scriptStartPosition.line - 1) {
                segment[3]! += scriptStartPosition.column
            }
            if (compilerOptions.debugeMode) {
                segment[2]! += 10
            }
        })
        temp[i + sourceMapInfo.tempStoredImportStartLine] = mappingLine
    }

    replaceEachItems(sourceMapInfo.mappings, temp)
}

// 记录一条源码位置与生成代码位置一致的映射信息（转换和生成代码的过程中处理偏移）
export function recordMappingWithNoOffset(position: ASTPosition) {
    const { line, column, index } = position
    if (!sourceMapInfo.positionShouldNotBeMapped[index]) {
        recordMapping(line, column, line, column, index)
    }
}

// 根据指定生成行信息初始化一行mapping
// 如果索引前方缺少行，则将前方缺少的行一并进行初始化
function initGeneratedLineMapping(line: number) {
    if (sourceMapInfo.mappings[line]) {
        return
    }
    while (isUndefined(sourceMapInfo.mappings[line])) {
        sourceMapInfo.mappings[line--] = []
        if (line < 0) {
            break
        }
    }
}
