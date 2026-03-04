import type { CodeEditor } from "./editor"
import type {
    ASTLocation,
    ASTPosition,
    TemplateAttribute,
    TemplateNode
} from "#type-declarations/compiler"
import type { ContextPattern, PartialAnyNode } from "#type-declarations/estree"
import type { SourceMapLine, SourceMapMappings } from "@jridgewell/sourcemap-codec"

import {
    generateContextPattern,
    transformInterpolatedText,
    transformParsedExpression
} from "./runtime/interpolation"
import { PositionFlag } from "../enums"
import { inputDescriptor } from "../state"
import { nonWhitespaceRE } from "../regular"
import {
    getPosByIndex,
    isPositionFlagSetAtIndex,
    markSourcemapEndFlag,
    markSourcemapStartFlag
} from "../../util/compiler/position"
import { isUndefined } from "../../util/shared/assert"

export class CodeWriter {
    private _code = ""
    private _mappings: SourceMapMappings = []

    private indentLevel = 0
    private generateLine = 0
    private generateColumn = 0
    private mappingLine: SourceMapLine = []
    private nextSourcePos: ASTPosition | undefined

    constructor(private sourcemap = false) {
        this._mappings.push(this.mappingLine)
    }

    get code() {
        return this._code
    }

    get mappings() {
        return this._mappings
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

    writeLine(str: string) {
        return this.write(str).wrapLine()
    }

    indent(wrapLine = true) {
        ++this.indentLevel
        return wrapLine ? this.wrapLine() : this
    }

    dedent() {
        return (--this.indentLevel, this.wrapLine())
    }

    write(str: string) {
        for (let i = 0; i < str.length; i++) {
            this.writeCharacter(str[i], -1)
        }
        return this
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

    writeParsedExpression(key: any) {
        return (transformParsedExpression(this, key), this)
    }

    writeInterpolatedText(node: TemplateNode) {
        return (transformInterpolatedText(this, node), this)
    }

    writeContextPattern(node: ContextPattern, startSourceIndex: number) {
        return (generateContextPattern(this, node, startSourceIndex), this)
    }

    writeTemplateStr(str: string, sourceLoc: ASTLocation) {
        markSourcemapEndFlag(sourceLoc.end.index)
        markSourcemapStartFlag(sourceLoc.start.index)
        this.writeCharacter(str[0], sourceLoc.start.index)

        for (let i = 1; i < str.length; i++) {
            this.writeCharacter(str[i], -1)
        }
        return (this.writeCharacter("", sourceLoc.end.index), this)
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

    private get indentStr() {
        return inputDescriptor.indent.repeat(this.indentLevel)
    }

    private writeCharacter(character: string, sourceIndex: number, createMappingAtNodeEnd = true) {
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
            character && this.generateColumn++
        } else {
            this.generateLine++
            this._code += this.indentStr
            this.generateColumn = this.indentStr.length
            this._mappings.push((this.mappingLine = []))
        }
    }
}
