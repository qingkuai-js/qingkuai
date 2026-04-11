import type { Identifier } from "@babel/types"
import type { EstreeWalkContext } from "#type-declarations/compiler"

import { expect, test } from "vitest"
import { parse } from "@babel/parser"
import { walkEstree } from "../../../../src/compiler/estree/walk"

function localParse(source: string) {
    return parse(source, {
        strictMode: false,
        sourceType: "module",
        plugins: ["typescript"]
    })
}

function checkScopeIdentifiers(context: EstreeWalkContext<Identifier>, full: string[][]) {
    if (!context.value.name.startsWith("_mark")) {
        return
    }

    let size = 0
    let parentScope: EstreeWalkContext
    if (context.isScopeBoundary) {
        parentScope = context.scope!
    } else {
        parentScope = context.scope!.scope!
    }
    const current = full[parseInt(context.value.name.slice(5, -1)) - 1]
    if (context.scopeIdentifiers) {
        for (const name of context.scopeIdentifiers) {
            if (!parentScope.scopeIdentifiers?.has(name)) {
                expect(
                    current.includes(name),
                    `missing item for ${context.value.name}: "${name}"`
                ).toBeTruthy()
                size++
            }
        }
    }
    for (const name of current) {
        expect(
            context.scopeIdentifiers?.has(name),
            `block for ${context.value.name} does not has "${name}"`
        ).toBeTruthy()
    }
    expect(current.length, `size for ${context.value.name}`).toBe(size)
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

    walkEstree(ast, {
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
    walkEstree(ast, {
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

test("Class declarations and class expressions", () => {
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
    walkEstree(ast, {
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

        for(var v in {}) {
            _mark6_
        };

        for({w, x: y = z} of []){
            _mark7_
        }
    `)
    walkEstree(ast, {
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

test("Functions without BlockStatement", () => {
    const ast = localParse(`
        {
            _mark1_
            const a = (b, c = d, ...e) => _mark2_
            ;({ f: g = h, i: [j, k = l] }) => _mark3_

            const m = ([n, o = p, ...q], ...r) => (_mark4_, (s: t = u, ...v) => _mark5_)
        }
    `)
    walkEstree(ast, {
        Identifier(_, context) {
            checkScopeIdentifiers(context, [
                ["a", "m"],
                ["b", "c", "e"],
                ["g", "j", "k"],
                ["n", "o", "q", "r"],
                ["s", "v"]
            ])
        }
    })
})

test("For related statements without BlockStatement", () => {
    const ast = localParse(`
        for (let a, b; _mark1_; ) _mark2_;
        for (const { c, d: e = f, ...g } of _mark3_)
            for (var [h, i = j] in _mark4_) _mark5_;
        for(const {k = l, m : n = o} of {}) 
            ((p = q, ...r: s) => (_mark6_, t))(_mark7_)
    `)
    walkEstree(ast, {
        Identifier(_, context) {
            checkScopeIdentifiers(context, [
                ["a", "b"],
                ["a", "b"],
                [],
                ["c", "e", "g"],
                [],
                ["p", "r"],
                ["k", "n"]
            ])
        }
    })
})
