import { expect, test } from "vitest"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { compileIntermediate } from "../../../../src/compiler/compile"
import { matchCompileMessages } from "../../../../src/util/testing/match"

function compile(source: string) {
    return compileIntermediate(formatSourceCode(source))
}

test("Access inference: template access of derived propagates to mutated sources", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp(count * 2)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            status: "reactive"
        },
        double: {
            status: "derived"
        }
    })
    matchCompileMessages([])
})

test("Access inference: no promotion when the derived value is not accessed in template", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp(count * 2)
        </lang-js>

        <p>static text</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (not accessed in template)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: a derived value read via raw marks its sources as untracked", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp(count * 2)
        </lang-js>

        <p>{ raw(double) }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        double: {
            status: "derived"
        },
        count: {
            description: "raw (untracked in template)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: unmutated source is not promoted by propagation", () => {
    const source = `
        <lang-js>
            let count = 0
            const double = derivedExp(count * 2)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (never mutated)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: propagation follows chained derived values", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp(count * 2)
            const quad = derivedExp(double * 2)
        </lang-js>

        <p>{ quad }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            status: "reactive"
        }
    })
    matchCompileMessages([])
})

test("Access inference: reads inside raw calls of the derived argument do not propagate", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp(raw(count) * 2)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (untracked in template)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: reads inside arguments of derived values reachable via chains count as untracked template reads", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const inner = derivedExp(raw(count) * 2)
            const outer = derivedExp(inner * 2)
        </lang-js>

        <p>{ outer }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (untracked in template)"
        },
        inner: {
            status: "derived"
        },
        outer: {
            status: "derived"
        }
    })
    matchCompileMessages([])
})

test("Access inference: getter parameters shadowing sources are not propagated", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derived(count => count * 2)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (not accessed in template)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: sources read inside functions called by the getter are not propagated", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            function getDouble() {
                return count * 2
            }
            const double = derived(() => getDouble())
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (not accessed in template)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: reads inside nested functions of the derivedExp argument propagate", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp([1, 2, 3].filter(i => i < count).length)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            status: "reactive"
        }
    })
    matchCompileMessages([])
})

test("Access inference: derived getter reads propagate, including inside nested callbacks", () => {
    const source = `
        <lang-js>
            let total = 0
            let count = 0
            function setTotal(v) {
                total = v
            }
            function setCount(v) {
                count = v
            }
            const double = derived(() => total + [1].filter(i => i < count).length)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        total: {
            status: "reactive"
        },
        count: {
            status: "reactive"
        }
    })
    matchCompileMessages([])
})

test("Access inference: a function argument of derivedExp is never invoked and does not propagate", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            const double = derivedExp(() => count * 2)
        </lang-js>

        <p>{ double }</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        double: {
            description: "raw (downgraded)"
        },
        count: {
            description: "raw (not accessed in template)"
        }
    })
})

test("Access inference: mutated script-only state stays raw without diagnostics", () => {
    const source = `
        <lang-js>
            let timer = 0
            function start() {
                timer = 1
            }
        </lang-js>

        <p>static text</p>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        timer: {
            description: "raw (not accessed in template)"
        }
    })
    matchCompileMessages([])
})

test("Access inference: reads inside plain function bodies are not template accesses", () => {
    const source = `
        <lang-js>
            let count = 0
            function setCount(v) {
                count = v
            }
            function getDouble() {
                return count * 2
            }
        </lang-js>

        <button @click={ setCount }>{ getDouble() }</button>
    `
    expect(compile(source).identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (not accessed in template)"
        }
    })
    matchCompileMessages([])
})
