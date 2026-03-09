import type { EditInsertSnippet, EditReplacement, Range } from "#type-declarations/compiler"

import { PositionFlag } from "../enums"
import { inputDescriptor } from "../state"
import { isString } from "../../util/shared/assert"
import { isPositionFlagSetAtIndex } from "../../util/compiler/position"

export class CodeEditor {
    isEmbeddedScript: boolean

    private indexToSourceIndex: number[]
    private replacements: EditReplacement[]

    constructor(
        private source: string,
        private startSourceIndex: number
    ) {
        this.indexToSourceIndex = []
        this.replacements = Array(source.length + 1)
        this.isEmbeddedScript = startSourceIndex === inputDescriptor.script.loc.start.index
    }

    removeCharacter(index: number) {
        this.remove(index, index + 1)
    }

    getSourceIndex(index: number) {
        return this.indexToSourceIndex[index]
    }

    remove(start: number, end: number) {
        this.replacements[start] ??= {}
        this.replacements[start].removedLength = Math.max(
            end - start,
            this.replacements[start].removedLength ?? 0
        )
    }

    insert(index: number, value: string, sourceRange?: Range) {
        this.replacements[index] ??= {}
        ;(this.replacements[index].additions ??= []).push({
            value,
            sourceRange
        })
    }

    insertMulti(index: number, snippets: (string | EditInsertSnippet)[]) {
        for (const snippet of snippets) {
            const snippetIsString = isString(snippet)
            this.insert(
                index,
                snippetIsString ? snippet : snippet.value,
                snippetIsString ? undefined : snippet.sourceRange
            )
        }
    }

    replace(start: number, end: number, value: string, sourcemap = false) {
        this.remove(start, end)
        this.insert(start, value, sourcemap ? [start, end] : undefined)
    }

    get result() {
        if (this.startSourceIndex === -1) {
            return ""
        }

        const segments: string[] = []

        const recordIndexMap = (
            generateIndex: number,
            sourceIndex: number,
            key: keyof typeof PositionFlag = "Sourcemap"
        ) => {
            if (isPositionFlagSetAtIndex(PositionFlag[key], this.startSourceIndex + sourceIndex)) {
                this.indexToSourceIndex[generateIndex] = this.startSourceIndex + sourceIndex
            }
        }

        for (let i = 0, j = 0; i <= this.source.length; ) {
            const replacement = this.replacements[i]
            if (replacement?.removedLength) {
                i += replacement.removedLength
            } else {
                recordIndexMap(j, i, "SourcemapEnd")
            }
            if (replacement?.additions) {
                for (const addition of replacement.additions) {
                    if ((segments.push(addition.value), addition.sourceRange)) {
                        recordIndexMap(j, addition.sourceRange[0])
                        recordIndexMap(j + addition.value.length, addition.sourceRange[1])
                    }
                    j += addition.value.length
                }
            }
            if (replacement?.removedLength) {
                continue
            }
            recordIndexMap(j++, i, "SourcemapStart")

            if (i === this.source.length) {
                i++
            } else {
                segments.push(this.source[i++])
            }
        }
        return segments.join("")
    }

    get intermediateResult() {
        if (this.startSourceIndex === -1) {
            return ""
        }

        const segments: string[] = []
        for (let i = 0, j = 0; i < this.source.length; ) {
            const replacement = this.replacements[i]
            if (replacement?.removedLength) {
                i += replacement.removedLength
            }
            if (replacement?.additions) {
                for (const addition of replacement.additions) {
                    if ((segments.push(addition.value), addition.sourceRange)) {
                        for (let k = 0; k < addition.value.length - 1; k++) {
                            this.indexToSourceIndex[j + i] =
                                this.startSourceIndex + addition.sourceRange[0]
                        }
                        this.indexToSourceIndex[j + addition.value.length] =
                            this.startSourceIndex + addition.sourceRange[1]
                    }
                    j += addition.value.length
                }
            }
            if (!replacement?.removedLength) {
                segments.push(this.source[i])
                this.indexToSourceIndex[j++] = this.startSourceIndex + i++
            }
        }
        return segments.join("")
    }
}
