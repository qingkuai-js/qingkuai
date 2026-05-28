import type { TsNodeWithContext } from "#type-declarations/ts-ast"

import ts from "typescript"

import { expect, test } from "vitest"
import { parseTsScript } from "../../../../src/util/testing/ts-ast"
import { walkTsNodeWithContext } from "../../../../src/compiler/ts-ast/walk"

function collectIdentifiers(source: string): Map<string, TsNodeWithContext<ts.Identifier>[]> {
    const sourceFile = parseTsScript(source)
    const map = new Map<string, TsNodeWithContext<ts.Identifier>[]>()

    walkTsNodeWithContext(sourceFile, node => {
        if (!ts.isIdentifier(node)) {
            return
        }
        const name = node.text
        if (!map.has(name)) {
            map.set(name, [])
        }
        map.get(name)!.push(node)
    })

    return map
}

function expectBinding(source: string, truthy: string[], falsy: string[]) {
    const ids = collectIdentifiers(source)

    for (const name of truthy) {
        const nodes = ids.get(name)
        expect(nodes, `identifier "${name}" not found`).toBeTruthy()
        for (const node of nodes!) {
            expect(node.isBindingReference, `"${name}" should be a binding reference`).toBe(true)
        }
    }

    for (const name of falsy) {
        const nodes = ids.get(name)
        expect(nodes, `identifier "${name}" not found`).toBeTruthy()
        for (const node of nodes!) {
            expect(node.isBindingReference, `"${name}" should NOT be a binding reference`).toBe(
                false
            )
        }
    }
}

test("Expression: references, property names and assignment targets", () => {
    expectBinding(
        `
            a;
            b.c.d;
            e?.f?.g;
            h!.i!.j;
            k++;
            ++l;
            m--;
            --n;
            o += 1;
            p ||= q;
            r ? s : t;
            ;[u, v] = [w, x];
            ;({ y, z: A } = B);
            C as any;
            D satisfies string;
            <number>E;
        `,
        [
            "a",
            "b",
            "e",
            "h",
            "k",
            "l",
            "m",
            "n",
            "o",
            "p",
            "q",
            "r",
            "s",
            "t",
            "u",
            "v",
            "w",
            "x",
            "y",
            "A",
            "B",
            "C",
            "D",
            "E"
        ],
        ["c", "d", "f", "g", "i", "j", "z"]
    )
})

test("Declaration: variables, destructuring and resource declarations", () => {
    expectBinding(
        `
            const a = 1;
            const b = c;
            const [d, e] = [1, 2];
            const [f, g] = [h, i];
            const { j: k } = {};
            var { l, m, n: { o } } = p;

            using q = r();
            await using s = t.u();

            type v = w;
            interface x {}
            let y: z = 0;
        `,
        ["c", "h", "i", "p", "r", "t"],
        [
            "a",
            "b",
            "d",
            "e",
            "f",
            "g",
            "j",
            "k",
            "l",
            "m",
            "n",
            "o",
            "q",
            "s",
            "u",
            "v",
            "w",
            "x",
            "y",
            "z"
        ]
    )
})

test("Declaration: functions and parameters", () => {
    expectBinding(
        `
            function a() {}
            ;(function b() {})()
            function c(d, e = f) {}
            ;((g, h = i) => {})()
            function j({ k, l: m = n }) {}
            ;(([o, { p: [q = r] }]) => {})()
            s = ({
                t: {
                    u: {
                        v: w = x
                    }
                }
            }) => {}
            y = function z(A, B = { C, ...D }) {}
            E = (function([F = G, ...H]) {})()
            function I<J, K>(L: M, N = O as P as Q) {}
            ;(() => (R, S))()
        `,
        ["f", "i", "n", "r", "s", "x", "y", "C", "D", "E", "G", "O", "R", "S"],
        [
            "a",
            "b",
            "c",
            "d",
            "e",
            "g",
            "h",
            "j",
            "k",
            "l",
            "m",
            "o",
            "p",
            "q",
            "t",
            "u",
            "v",
            "w",
            "z",
            "A",
            "B",
            "F",
            "H",
            "I",
            "J",
            "K",
            "L",
            "M",
            "N",
            "P",
            "Q"
        ]
    )
})

test("Declaration: classes, computed names and accessors", () => {
    expectBinding(
        `
            class a {
                b = 1
                c = d
                [e] = 2
                f() {}
                [g]() {}
                h(i, j = k) {}
                [l]({
                    m,
                    n: {
                        o = p
                    }
                }) {
                    this.q
                }
                get r() { return s }
                set r(t) { this.u = v }

                #w
                #x = y
            }

            class z extends A {}
            class B implements C {}
            class D extends E<F> {
                G<H, I>(J: K, L = M as N) {}
            }
        `,
        ["d", "e", "g", "k", "l", "p", "s", "v", "y", "A", "E", "M"],
        [
            "a",
            "b",
            "c",
            "f",
            "h",
            "i",
            "j",
            "m",
            "n",
            "o",
            "q",
            "r",
            "t",
            "u",
            "z",
            "B",
            "C",
            "D",
            "F",
            "G",
            "H",
            "I",
            "J",
            "K",
            "L",
            "N"
        ]
    )
})

test("Module/Type: import and type-only syntax", () => {
    expectBinding(
        `
            import a from "x"
            import { b } from "y"
            import { c as d } from "z"
            import * as e from "w"
            import type { F as G } from "u"
            import { type H as I, J } from "v"

            type K<L> = L extends M<infer N> ? N : O
            export as namespace P
            const Q: K<M<R>> = S
        `,
        ["S"],
        ["a", "b", "c", "d", "e", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"]
    )
})

test("Statement: labels, for statements and catch clauses", () => {
    expectBinding(
        `
            ;[a, b = c, ...d] = [e, f, ...g]
            ;({ h, i: j = k, l: { m: n } } = {})
            for ({ o, p: { q = r } } in s) {}
            t: for ([u, v, ...w] of x) {
                continue t
                break t
            }
            try {} catch ({ A, B: { C = D }, ...E }) {}
        `,
        [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g",
            "h",
            "j",
            "k",
            "n",
            "o",
            "q",
            "r",
            "s",
            "u",
            "v",
            "w",
            "x",
            "D"
        ],
        ["i", "l", "m", "p", "t", "A", "B", "C", "E"]
    )
})
