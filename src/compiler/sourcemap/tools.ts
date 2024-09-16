import type { SourceMapMappings, SourceMapSegment } from "@jridgewell/sourcemap-codec"

import { compilerOptions } from "../configuration"
import { getGeneratedLine } from "../../util/compiler/state"
import { isUndefined, replaceEachItems } from "../../util/shared"
import { inputDescriptor, sourceMapInfo, tempStoredImportInfos } from "../state"
import { getAlias } from "../analyzer/alias"

// 记录一条sourcemap mapping segment
export function recordMapping(
    generatedLine: number,
    generatedColumn: number,
    sourceLine: number,
    sourceColumn: number,
    sourceIndex: number,
    isTemplate = false
) {
    sourceLine = getGeneratedLine(sourceLine)
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
    // console.log(sourceMapInfo.mappings)
    let temp: SourceMapMappings = []
    const { indentSpaceCount } = inputDescriptor
    const scriptLoc = inputDescriptor.script.loc
    const scriptStartPosition = scriptLoc.start
    const firstTemplateLine = scriptLoc.end.line + 3

    // 生成代码行偏移（生成代码固定前8行无sourcemap信息）
    for (let i = 0; i < sourceMapInfo.preaddedLineCount + 8; i++) {
        temp.push([])
    }

    // 生成代码行列偏移，根据映射段下标为1的元素（代表是否模板映射段）有以下两种处理情况：
    // 1. script映射段：则将所有生成列偏移一个缩进量，当段处于script第一行时还应该额外偏移 <script ...> 开始标签的量
    // 2. template映射段：只需要让第一行的段偏移sorucemapInfo.columnOffsetOfFirstTemplateLine的值即可（这个值为
    // 固定两个缩进量 + setTemplateStructure（确认别名后）+ 2（函数调用字符 ([ 的固定长度），最后将segment[1]置为0
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
    // 当import语句和<script>标签处在同一行时，需要将源码列信息发生偏移
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
