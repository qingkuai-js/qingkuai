import type { ASTPosition } from "#type-declarations/compiler"
import type { PartialAnyNode } from "#type-declarations/estree"
import type { SourceMapLine, SourceMapMappings } from "@jridgewell/sourcemap-codec"

import { PositionFlag } from "../../enums"
import { inputDescriptor } from "../../state"
import { getPosByIndex, isPositionFlagSetAtIndex } from "../../../util/compiler/position"

export class CodeWriter {
    code = ""
    indentLevel = 0
    mappings: SourceMapMappings = []
    nextSourcePos: ASTPosition | undefined

    private generateLine = 0
    private generateColumn = 0
    private mappingLine: SourceMapLine = []

    constructor() {
        this.mappings.push(this.mappingLine)
    }

    wrapLine(count = 1) {
        for (let i = 0; i < count; i++) {
            this.writeCharacter("\n", -1)
        }
        return this
    }

    indent() {
        return ((this.indentLevel++, this.wrapLine()), this)
    }

    dedent() {
        return ((this.indentLevel--, this.wrapLine()), this)
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

    private writeCharacter(character: string, sourceIndex: number) {
        if (inputDescriptor.options.sourcemap) {
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
            this.nextSourcePos = inputDescriptor.positions[sourceIndex + 1]
        }
        if (((this.code += character), "\n" !== character)) {
            this.generateColumn++
        } else {
            const indentStr = inputDescriptor.indent.repeat(this.indentLevel)
            this.generateLine++
            this.code += indentStr
            this.generateColumn = indentStr.length
            this.mappings.push((this.mappingLine = []))
        }
    }
}
