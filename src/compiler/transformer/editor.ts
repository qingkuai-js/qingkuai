import type { EditInsertSnippet, EditReplacement, Range } from "#type-declarations/compiler"
import { isPositionFlagSetAtIndex } from "../../util/compiler/position"

import { isString } from "../../util/shared/assert"
import { PositionFlag } from "../enums"

export class CodeEditor {
    private indexToSourceIndex: number[]
    private replacements: EditReplacement[]

    constructor(
        private source: string,
        private startSourceIndex: number
    ) {
        this.replacements = Array(source.length)
        this.indexToSourceIndex = Array(source.length)
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

        for (let i = 0, j = 0; i < this.source.length; ) {
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
            if (i < this.source.length) {
                recordIndexMap(j++, i, "SourcemapStart")
                segments.push(this.source[i++])
            }
        }
        return segments.join("")
    }
}
