import ts from "typescript"

import { expect, test } from "vitest"
import { walkTsNode } from "../../../../../src/compiler/ts-ast/walk"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { isBindingReference } from "../../../../../src/compiler/ts-ast/assert"

function collectIdentifiers(source: string): Map<string, ts.Identifier[]> {
    const sourceFile = parseTsScript(source)
    const map = new Map<string, ts.Identifier[]>()
    walkTsNode(sourceFile, node => {
        if (ts.isIdentifier(node)) {
            const name = node.text
            if (!map.has(name)) {
                map.set(name, [])
            }
            map.get(name)!.push(node)
        }
    })
    return map
}

function expectBinding(source: string, truthy: string[], falsy: string[]) {
    const ids = collectIdentifiers(source)
    for (const name of truthy) {
        const nodes = ids.get(name)
        expect(nodes, `identifier "${name}" not found`).toBeTruthy()
        for (const node of nodes!) {
            expect(isBindingReference(node), `"${name}" should be a binding reference`).toBeTruthy()
        }
    }
    for (const name of falsy) {
        const nodes = ids.get(name)
        expect(nodes, `identifier "${name}" not found`).toBeTruthy()
        for (const node of nodes!) {
            expect(
                isBindingReference(node),
                `"${name}" should NOT be a binding reference`
            ).toBeFalsy()
        }
    }
}

test("Expression: binding references in complex expressions", () => {
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
            "A",
            "B",
            "C",
            "D",
            "E"
        ],
        ["c", "d", "f", "g", "i", "j", "z"]
    )
})

test("Expression: property names in access expressions are not references", () => {
    expectBinding(
        `
            a.b;
            c.d.e;
            f?.g;
        `,
        ["a", "c", "f"],
        ["b", "d", "e", "g"]
    )
})

test("Declaration: variable declarations and destructuring", () => {
    // Cover top-level declaration forms commonly used in script blocks.
    expectBinding(
        `
            const a = 1;
            const b = c;
            const [d, e] = [1, 2];
            const [f, g] = [h, i];
            const { j: k } = {}
            var { l, m, n: { o } } = p
            let q: r = 0
        `,
        ["c", "h", "i", "p"],
        ["a", "b", "d", "e", "f", "g", "j", "k", "l", "m", "n", "o", "q", "r"]
    )
})

test("Declaration: using and await using resource declarations", () => {
    // Resource declarations are common business syntax in modern TS scripts.
    expectBinding(
        `
            using a = b()
            await using c = d.e()
        `,
        ["b", "d"],
        ["a", "c", "e"]
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
            s = ({ t: { u: { v: w = x } } }) => {}
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

test("Declaration: classes", () => {
    expectBinding(
        `
            class a {
                b = 1
                c = d
                [e] = 2
                f() {}
                [g]() {}
                h(i, j = k) {}
                get r() {}
                set r(s) {}
            }
            class y extends z {}
            class A implements B {}
            class C extends D<E> {
                F<G, H>(I: J, K = L as M) {}
            }
        `,
        ["d", "e", "g", "k", "z", "D", "L"],
        [
            "a",
            "b",
            "c",
            "f",
            "h",
            "i",
            "j",
            "r",
            "s",
            "y",
            "A",
            "B",
            "C",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J",
            "K",
            "M"
        ]
    )
})

test("Declaration: accessor names are not references", () => {
    expectBinding(
        `
            class a {
                get b() { return c }
                set d(e) { this.f = g }
            }
        `,
        ["c", "g"],
        ["a", "b", "d", "e", "f"]
    )
})

test("Module/Type: import declarations", () => {
    expectBinding(
        `
            import a from 'x'
            import { b } from 'y'
            import { c as d } from 'z'
            import * as e from 'w'
        `,
        [],
        ["a", "b", "c", "d", "e"]
    )
})

test("Module/Type: import type declarations", () => {
    // Type imports should never be treated as runtime binding references.
    expectBinding(
        `
            import type { A as B } from 'x'
            import { type C as D, E } from 'y'
        `,
        [],
        ["A", "B", "C", "D", "E"]
    )
})

test("Module/Type: type-only identifiers", () => {
    expectBinding(
        `
            type A = B
            interface C {}
            let x: D = e
            let y: E.F = g
        `,
        ["e", "g"],
        ["A", "B", "C", "D", "x", "y", "E", "F"]
    )
})

test("Module/Type: conditional type with infer", () => {
    // `infer` introduces type parameters that must stay type-only.
    expectBinding(
        `
            interface A<B> {}
            type C<D> = D extends A<infer E> ? E : D
            const F: C<A<G>> = H
        `,
        ["H"],
        ["A", "B", "C", "D", "E", "F", "G"]
    )
})

test("Module/Type: namespace and enum declarations", () => {
    expectBinding(
        `
            namespace a {
                const b = 1
            }
            enum c { d, e }
            import f = require('mod')
        `,
        ["d", "e"],
        ["a", "b", "c", "f"]
    )
})

test("Module/Type: namespace export declaration name is not a reference", () => {
    expectBinding(
        `
            export as namespace A
        `,
        [],
        ["A"]
    )
})

test("Statement: labels, destructuring and catch", () => {
    expectBinding(
        `
            ;[a, b = c, ...d] = [e, f, ...g]
            ;({ h, i: j = k, l: { m: n } } = {})
            for ({ o, p: { q = r } } in s) {}
            t: for ([u, v, ...w] of x) {
                continue t
                break t
            }
            try {} catch ({ D, E: { F = G }, ...H }) {}
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
            "G"
        ],
        ["i", "l", "m", "p", "t", "D", "E", "F", "H"]
    )
})

test("Assignment: object property keys are not references", () => {
    expectBinding(
        `
            const h = {
                a: b,
                e: f.g
            }
        `,
        ["b", "f"],
        ["h", "a", "e", "g"]
    )
})
