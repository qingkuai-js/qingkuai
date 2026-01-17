import type { Identifier } from "@babel/types"

import { expect, test } from "vitest"
import { parse } from "@babel/parser"
import { walk, WalkContext } from "../../../src/util/compiler/estree/walk"

function localParse(source: string) {
    return parse(source, {
        strictMode: false,
        sourceType: "module",
        plugins: ["typescript"]
    })
}

function checkScopeIdentifiers(context: WalkContext<Identifier>, full: string[][]) {
    if (!context.value.name.startsWith("_mark")) {
        return
    }

    let size = 0
    const prevScope = context.scope!.scope!
    const current = full[parseInt(context.value.name.slice(5, -1)) - 1]
    for (const name of context.scopeIdentifiers) {
        if (!prevScope.scopeIdentifiers.has(name)) {
            expect(
                current.includes(name),
                `missing item for ${context.value.name}: "${name}"`
            ).toBeTruthy()
            size++
        }
    }
    for (const name of current) {
        expect(
            context.scopeIdentifiers.has(name),
            `block for ${context.value.name} does not has "${name}"`
        ).toBeTruthy()
    }
    expect(current.length).toBe(size)
}

test("Variable declarations", () => {
    const ast = localParse(`
        if(condition){
            _mark1_;
            let a;
            const b = 1;
            let {c, d: e, f: {g: h = i}} = {};

            var [j, [k]] = [];

            enum l {}
            enum l {}
            namespace m{
                _mark2_;
                var n;
                const o = 0;
                namespace p{
                    _mark3_;
                    var q;
                    let r;
                }
            }

            namespace s.t.u{
                // will not emit js
            }

            namespace v.w.x{
                __mark4__;
                const y = 0;
            }

            try{
                _mark5_;
                var v: any;
                let w: string;
            }catch(x: Error){
                _mark6_;
            }
        }
    `)

    walk(ast, {
        Identifier(_, context) {
            checkScopeIdentifiers(context, [
                ["a", "b", "c", "e", "h", "l", "m", "v"],
                ["n", "o", "p"],
                ["q", "r"],
                ["y"],
                ["w"],
                ["x"]
            ])
        }
    })
})

test("Function declarations and function expressions", () => {
    const ast = localParse(`
        function a(b, { b: c = d }, [e, [f]]) {
            _mark1_
            let g
            var { h: i } = {}

            ;(function j(k, { l: m }) {
                _mark2_
                var n
            })

            const o = (p, [q]) => {
                _mark3_
                var s
                return {
                    r(t, { u: v }) {
                        var w
                        _mark4_
                    }
                }
            }

            enum x {}
            namespace y {
                _mark5_
                const z = 1
            }
        }
    `)
    walk(ast, {
        Identifier(_, context) {
            checkScopeIdentifiers(context, [
                ["b", "c", "e", "f", "g", "i", "o", "x", "y"],
                ["j", "k", "m", "n"],
                ["p", "q", "s"],
                ["t", "v", "w"],
                ["z"]
            ])
        }
    })
})

test("Class decalrations and class expressions", () => {
    const ast = localParse(`
        class a {
            _mark1_
            b = 1

            c(d, { e: f = g, h: { i } = j }) {
                _mark2_
            }
            #d([k, [l = m], [n] = o]) {
                _mark3_
                return class {
                    constructor(public q,  private r = s){
                        _mark4_
                        var t
                    }
                    u(v, w = x){
                        _mark5_
                        let y
                        var {z, A: B = C, D: { E } = F} = {}
                    }
                    #G(H, I = J, {K: L = M}){
                        _mark6_
                        var N
                        enum O {}
                    }
                }
            }
        }
    `)
    walk(ast, {
        Identifier(_, context) {
            checkScopeIdentifiers(context, [
                [],
                ["d", "f", "i"],
                ["k", "l", "n"],
                ["q", "r", "t"],
                ["v", "w", "y", "z", "B", "E"],
                ["H", "I", "L", "N", "O"]
            ])
        }
    })
})

test("For statements", () => {
    const ast = localParse(`
        for(let a, {b, c: d = e, f: { g }} = {};;){
            _mark1_
            const h = 0
            var i
            var [j, [k]] = []
        }

        for(var l, [m] = [];;){
            _mark2_
            var n
        }

        for(const o of p){
            _mark3_
        }

        for(var {q: r} of {}){
            _mark4_
            var s
            let t
        }

        for(const u in []){
            _mark5_
        }

        for(var v in {}){
            _mark6_
        }

        for({w, x: y = z} of []){
            _mark7_
        }

    `)
    walk(ast, {
        Identifier(_, context) {
            checkScopeIdentifiers(context, [
                ["a", "b", "d", "g", "h"],
                [],
                ["o"],
                ["t"],
                ["u"],
                [],
                []
            ])
        }
    })
})
