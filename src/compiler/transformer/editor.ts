import type { Replacement } from "#type-declarations/compiler"

import assert from "node:assert"

export class CodeEditor {
    private replacements: Replacement[]

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
        this.replace(start, end, "")
    }

    insert(index: number, value: string) {
        this.replace(index, index, value)
    }

    replace(start: number, end: number, value: string) {
        assert(!this.replacements[start])
        this.replacements[start] = {
            value,
            index: start,
            length: end - start
        }
    }

    get result() {
        const segments: string[] = []
        for (let i = 0; i < this.source.length; ) {
            const replacement = this.replacements[i]
            if (replacement) {
                i += replacement.length
                segments.push(replacement.value)

                if (replacement.length) {
                    continue
                }
            }
            if (i < this.source.length) {
                segments.push(this.source[i++])
            }
        }
        return segments.join("")
    }
}
