import type { Identifier } from "@babel/types"
import type { WalkContext } from "../../../src/util/compiler/estree/walk"

import { parse } from "@babel/parser"
import { expect, test } from "vitest"
import { any } from "../../../src/util/shared/sundry"
import { walk } from "../../../src/util/compiler/estree/walk"

const localParse = (source: string) => {
    return parse(source, {
        strictMode: false,
        sourceType: "module",
        plugins: ["typescript"]
    })
}

const checkShorthandBindingReference = (context: WalkContext<Identifier>) => {
    expect(context.isShorthandIdentifier).toBeTruthy()
    expect(context.isBindingReference).toBe(any(context).parent.value.value === context.value)
}

test("Expressions", () => {
    const ast = localParse(`
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
    `)
    walk(ast, {
        Identifier(node, context) {
            switch (node.name) {
                case "y": {
                    return checkShorthandBindingReference(context)
                }
                case "c":
                case "d":
                case "f":
                case "g":
                case "i":
                case "j":
                case "z": {
                    return expect(context.isBindingReference).toBeFalsy()
                }
                default: {
                    return expect(context.isBindingReference).toBeTruthy()
                }
            }
        }
    })
})

test("Variables", () => {
    const ast = localParse(`
        const a = 1;
        const b = c;
        const [d, e] = [1, 2];
        const [f, g] = [h, i];
        const {j: k} = {}
        var { l, m, n: { o } } = p
        
        using q = r()
        await using s = t.u()

        type v = w
        interface x{}
        let y: z = 0
    `)
    walk(ast, {
        Identifier(node, context) {
            switch (node.name) {
                case "c":
                case "h":
                case "i":
                case "p":
                case "r":
                case "t": {
                    return expect(context.isBindingReference).toBeTruthy()
                }
                default: {
                    return expect(context.isBindingReference).toBeFalsy()
                }
            }
        }
    })
})

test("Functions", () => {
    const ast = localParse(`
        function a(){}
        ;(function b(){})()
        function c(d, e = f){}
        ;((g, h = i)=>{})()
        function j({ k, l: m = n }){}
        ;(([o, { p: [q = r] }])=>{})()
        s = ({
            t: {
                u: {
                    v: w = x
                }
            }
        })=>{}
        y = function z(A, B = {C, ...D}){}
        E = (function ([F = G, ...H]){})()
        function I<J, K>(L: M, N = O as P as Q){}
    `)
    walk(ast, {
        Identifier(node, context) {
            switch (node.name) {
                case "C": {
                    return checkShorthandBindingReference(context)
                }
                case "f":
                case "i":
                case "n":
                case "r":
                case "s":
                case "x":
                case "y":
                case "D":
                case "E":
                case "G":
                case "O": {
                    return expect(context.isBindingReference).toBeTruthy()
                }
                default: {
                    return expect(context.isBindingReference).toBeFalsy()
                }
            }
        }
    })
})

test("Classes", () => {
    const ast = localParse(`
        class a{
            b = 1
            c = d
            [e] = 2
            f(){}
            [g](){}
            h(i, j = k){}
            [l]({
                m,
                n: {
                    o = p
                }
            }){
                this.q
            }
            get r(){}
            set r(s){}

            #t
            #u = v
            #w(){
                this.#t = x
            }
        }

        class y extends z{}
        class A implements B{}
        class C implements D, E<F>{}

        class G extends H<I, J>{
            K<L, M>(N: O, P = Q as R){}
        }
    `)
    walk(ast, {
        Identifier(node, context) {
            switch (node.name) {
                case "d":
                case "e":
                case "g":
                case "k":
                case "l":
                case "p":
                case "v":
                case "x":
                case "z":
                case "H":
                case "Q": {
                    return expect(context.isBindingReference).toBeTruthy()
                }
                default: {
                    return expect(context.isBindingReference).toBeFalsy()
                }
            }
        }
    })
})

test("Statements", () => {
    const ast = localParse(`
        ;[a, b = c, ...d] = [e, f, ...g]
        ;({
            h,
            i: j = k,
            l: { m: n }
        } = {})
        for({
            o,
            p: { q = r }
        } in s){}
        t: for([u, v, ...w] of x){
            continue t
            break t
        }
        with(y){}
        with({
            z,
            A: {
                B: { C }
            }
        }){}
        try{}catch({
            D,
            E: { F = G },
            ...H
        }){}
    `)
    walk(ast, {
        Identifier(node, context) {
            switch (node.name) {
                case "h":
                case "o":
                case "z":
                case "C":
                    return checkShorthandBindingReference(context)
                case "b":
                case "i":
                case "j":
                case "l":
                case "m":
                case "p":
                case "q":
                case "t":
                case "A":
                case "B":
                case "D":
                case "E":
                case "F":
                case "H": {
                    return expect(context.isBindingReference).toBeFalsy()
                }
                default: {
                    return expect(context.isBindingReference).toBeTruthy()
                }
            }
        }
    })
})
