import type { CodeEditor } from "./editor"
import type { AnyNode, PartialAnyNode } from "#type-declarations/estree"
import type { SourceMapLine, SourceMapMappings } from "@jridgewell/sourcemap-codec"
import type { ASTLocation, ASTPosition, Range, TemplateNode } from "#type-declarations/compiler"

import {
    getPosByIndex,
    markPositionFlag,
    isPositionFlagSetAtIndex
} from "../../util/compiler/position"
import { PositionFlag } from "../enums"
import { inputDescriptor } from "../state"
import { nonWhitespaceRE } from "../regular"
import { isNumber } from "../../util/shared/assert"
import { encode } from "@jridgewell/sourcemap-codec"
import { transformInterpolatedText, writeParsedExpression } from "./runtime/interpolation"

abstract class BaseCodeWriter {
    protected abstract get indentStr(): string
    public abstract write(str: string, startSourceIndex?: number): this
    protected abstract writeCharacter(character: string, sourceIndex: number): void

    protected _code = ""
    protected indentLevel = 0

    get code() {
        return this._code
    }

    get length() {
        return this._code.length
    }

    get empty() {
        return !this._code.trim()
    }

    wrapLine(count = 1) {
        for (let i = 0; i < count; i++) {
            this.writeCharacter("\n", -1)
        }
        return this
    }

    indent(wrapLine = true) {
        ++this.indentLevel
        return wrapLine ? this.wrapLine() : this
    }

    dedent(wrapLine = true) {
        --this.indentLevel
        return wrapLine ? this.wrapLine() : this
    }

    writeLine(str: string, startSourceIndex = -1) {
        return this.write(str, startSourceIndex).wrapLine()
    }
}

export class RuntimeCodeWriter extends BaseCodeWriter {
    private _mappings: SourceMapMappings = []

    private generateLine = 0
    private generateColumn = 0
    private mappingLine: SourceMapLine = []
    private nextSourcePos: ASTPosition | undefined

    constructor(private sourcemap = false) {
        super()
        this._mappings.push(this.mappingLine)
    }

    get mappings() {
        return encode(this._mappings)
    }

    write(str: string, startSourceIndex = -1) {
        for (let i = 0; i < str.length; i++) {
            this.writeCharacter(str[i], i ? -1 : startSourceIndex)
        }
        return this
    }

    writeParsedExpression(key: any) {
        return (writeParsedExpression(this, key), this)
    }

    writeInterpolatedText(node: TemplateNode) {
        return (transformInterpolatedText(this, node), this)
    }

    writeTemplateStr(str: string, sourceLoc: ASTLocation) {
        this.writeCharacter(str[0], sourceLoc.start.index)
        markPositionFlag(PositionFlag.SourcemapEnd, sourceLoc.end.index)
        markPositionFlag(PositionFlag.SourcemapStart, sourceLoc.start.index)

        for (let i = 1; i < str.length; i++) {
            this.writeCharacter(str[i], -1)
        }
        return (this.writeCharacter("", sourceLoc.end.index), this)
    }

    writeScriptNode(node: PartialAnyNode, dedent = true) {
        if (node) {
            const range = node.range!
            const str = inputDescriptor.script.code.slice(...range)
            for (let i = 0; i < str.length; i++) {
                if (
                    dedent &&
                    "\n" === str[i - 1] &&
                    str.slice(i).startsWith(inputDescriptor.indent)
                ) {
                    i += inputDescriptor.indent.length - 1
                } else {
                    this.writeCharacter(
                        str[i],
                        inputDescriptor.script.loc.start.index + range[0] + i
                    )
                }
            }
        }
        return this
    }

    writeEditedScript(editor: CodeEditor) {
        const { isEmbeddedScript } = editor
        const editedContent = editor.result.trimEnd()
        const nonEmptyIndex = editedContent.search(nonWhitespaceRE)
        if (nonEmptyIndex === -1) {
            return this
        }
        if (isEmbeddedScript) {
            this.dedent().write(inputDescriptor.indent)
        }
        for (let i = 0; i < nonEmptyIndex; i++) {
            this.writeCharacter("", editor.getSourceIndex(i) ?? -1, false)
        }
        for (let i = nonEmptyIndex; i < editedContent.length; i++) {
            this.writeCharacter(editedContent[i], editor.getSourceIndex(i) ?? -1, false)
        }
        if (!isEmbeddedScript) {
            this.writeCharacter("", editor.getSourceIndex(editedContent.length) ?? -1, false)
        }
        return isEmbeddedScript ? this.indent(false) : this
    }

    protected get indentStr() {
        return inputDescriptor.indent.repeat(this.indentLevel)
    }

    protected writeCharacter(
        character: string,
        sourceIndex: number,
        createMappingAtNodeEnd = true
    ) {
        if (this.sourcemap && inputDescriptor.options.sourcemap) {
            if (
                this.nextSourcePos &&
                -1 === sourceIndex &&
                isPositionFlagSetAtIndex(PositionFlag.Sourcemap, this.nextSourcePos.index)
            ) {
                this.mappingLine.push([
                    this.generateColumn,
                    0,
                    this.nextSourcePos.line - 1,
                    this.nextSourcePos.column
                ])
            } else if (
                -1 !== sourceIndex &&
                isPositionFlagSetAtIndex(PositionFlag.Sourcemap, sourceIndex)
            ) {
                const { line, column } = getPosByIndex(sourceIndex)
                this.mappingLine.push([this.generateColumn, 0, line - 1, column])
            }
            if (!createMappingAtNodeEnd) {
                this.nextSourcePos = undefined
            } else {
                this.nextSourcePos = inputDescriptor.positions[sourceIndex + 1]
            }
        }
        if (((this._code += character), "\n" !== character)) {
            if (character) {
                this.generateColumn++
            }
        } else {
            this.generateLine++
            this._code += this.indentStr
            this.generateColumn = this.indentStr.length
            this._mappings.push((this.mappingLine = []))
        }
    }
}

export class IntermediateCodeWriter extends BaseCodeWriter {
    private stoi: number[]
    private itos: number[] = []
    private nextSourceIndex = -1

    public gtdii: number[] = [] // Get Type Delay Intermediate Indexes

    constructor() {
        super()
        this.stoi = Array(inputDescriptor.source.length + 1).fill(-1)
    }

    get indexMap() {
        return {
            itos: this.itos,
            stoi: this.stoi
        }
    }

    writeScriptNode(node: AnyNode) {
        const startSourceIndex = inputDescriptor.script.loc.start.index
        return this.write(
            inputDescriptor.source.slice(
                startSourceIndex + node.start!,
                startSourceIndex + node.end!
            ),
            startSourceIndex + node.start!
        )
    }

    writeEditedScript(editor: CodeEditor) {
        const editedContent = editor.intermediateResult
        for (let i = 0; i < editedContent.length; i++) {
            const isLast = i === editedContent.length - 1
            const sourceIndex = editor.getSourceIndex(i) ?? -1
            this.writeCharacter(
                editedContent[i],
                sourceIndex,
                isLast && sourceIndex === -1 ? -1 : sourceIndex + 1
            )
        }
        return this
    }

    write(str: string, sourceRange?: Range): this
    write(str: string, startSourceIndex?: number): this
    write(str: string, indexOrRange: Range | number = -1) {
        // 未闭合的插值块的结束索引为 -1，此时只需使用开始索引进行映射
        // The end index of an unclosed interpolation block is -1; in this
        // case only the start index needs to be used for mapping
        if (!isNumber(indexOrRange) && indexOrRange[1] === -1) {
            indexOrRange = indexOrRange[0]
        }

        if (isNumber(indexOrRange)) {
            for (let i = 0; i < str.length; i++) {
                const isLast = i === str.length - 1
                const sourceIndex = indexOrRange === -1 ? -1 : indexOrRange + i
                this.writeCharacter(
                    str[i],
                    sourceIndex,
                    isLast && sourceIndex === -1 ? -1 : sourceIndex + 1
                )
            }
        } else {
            for (let i = 0; i < str.length; i++) {
                const isLast = i === str.length - 1
                const sourceIndex = Math.min(indexOrRange[0] + i, indexOrRange[1] - 1)
                this.writeCharacter(str[i], sourceIndex, isLast ? indexOrRange[1] : -1)
            }
            for (let i = str.length; i < indexOrRange[1] - indexOrRange[0]; i++) {
                if (this.indexMap.stoi[indexOrRange[0] + i] !== -1) {
                    continue
                }
                this.indexMap.stoi[indexOrRange[0] + i] = this.indexMap.itos.length - 1
            }
        }
        return this
    }

    protected get indentStr() {
        return " ".repeat(this.indentLevel * 4)
    }

    protected writeCharacter(character: string, sourceIndex: number, nextSourceIndex = -1) {
        if (sourceIndex !== -1) {
            this.nextSourceIndex = nextSourceIndex
        } else if (this.nextSourceIndex !== -1) {
            sourceIndex = this.nextSourceIndex
            this.nextSourceIndex = -1
        }
        if (sourceIndex !== -1 && this.stoi[sourceIndex] === -1) {
            this.stoi[sourceIndex] = this.code.length
        }
        this._code += character
        this.itos.push(sourceIndex)

        if (character === "\n") {
            this._code += this.indentStr
            this.itos.push(...Array(this.indentStr.length).fill(-1))
        }
    }
}
