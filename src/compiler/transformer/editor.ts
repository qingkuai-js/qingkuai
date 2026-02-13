import type { EditInsertSnippet, EditReplacement, Range } from "#type-declarations/compiler"
import { isString } from "../../util/shared/assert"

export class CodeEditor {
    private replacements: EditReplacement[]

    constructor(
        private source: string,
        private startSourceIndex: number
    ) {
        this.replacements = Array(source.length)
    }

    removeCharacter(index: number) {
        this.remove(index, index + 1)
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
        for (let i = 0; i < this.source.length; ) {
            const operateIndex = i
            const replacement = this.replacements[i]
            if (replacement?.removedLength) {
                i += replacement.removedLength
            }
            if (replacement?.additions) {
                for (const addition of replacement.additions) {
                    segments.push(addition.value)
                }
            }
            if (operateIndex !== i) {
                continue
            }
            if (i < this.source.length) {
                segments.push(this.source[i++])
            }
        }
        return segments.join("")
    }
}
