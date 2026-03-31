import { expect, test } from "vitest"
import { parse, parseExpression } from "@babel/parser"

import {
    is,
    isBlock,
    isContextPattern,
    isExpressionEqual,
    isFunctionLiteral,
    isInlineEventHandler,
    isIntrinsicCall,
    isLeftValue,
    isLiteral,
    isPropertyEqual,
    isTypeOperation,
    isUndefinedLiteral,
    willModuleDeclarationEmitsJS
} from "../../../../src/compiler/estree/assert"

const PARSE_OPTS = {
    sourceType: "module" as const,
    plugins: ["typescript"] as any
}

function expr(source: string): any {
    return parseExpression(source, PARSE_OPTS)
}

function stmt(source: string): any {
    return parse(source, PARSE_OPTS).program.body[0]
}

function exprEqual(a: string, b: string): boolean {
    return isExpressionEqual(expr(a), expr(b))
}

function propEqual(a: string, b: string): boolean {
    return isPropertyEqual(expr(a).property, expr(b).property)
}

test("Function: isPropertyEqual", () => {
    expect(propEqual("obj.foo", "obj.foo")).toBe(true)
    expect(propEqual("obj.foo", "obj.bar")).toBe(false)

    expect(propEqual("obj.foo", "obj['foo']")).toBe(true)
    expect(propEqual("obj['foo']", "obj['foo']")).toBe(true)

    expect(propEqual("obj['']", "obj['']")).toBe(true)

    expect(propEqual("obj[0]", "obj[0]")).toBe(true)
    expect(propEqual("obj[0]", "obj[1]")).toBe(false)
    expect(propEqual("obj['0']", "obj[0]")).toBe(true)

    expect(propEqual("obj[`foo`]", "obj[`foo`]")).toBe(true)
    expect(propEqual("obj[`foo`]", "obj['foo']")).toBe(true)
    expect(propEqual("obj[``]", "obj['']")).toBe(true)

    expect(propEqual("obj[`${x}`]", "obj[`${x}`]")).toBe(false)

    expect(propEqual("obj[foo as string]", "obj[foo]")).toBe(true)
    expect(propEqual("obj[foo!]", "obj[foo]")).toBe(true)
    expect(propEqual("obj[foo satisfies string]", "obj[foo]")).toBe(true)
})

test("Function: isExpressionEqual", () => {
    expect(exprEqual("foo", "foo")).toBe(true)
    expect(exprEqual("foo", "bar")).toBe(false)

    expect(exprEqual("obj.foo", "obj.foo")).toBe(true)
    expect(exprEqual("obj.foo", "obj.bar")).toBe(false)
    expect(exprEqual("obj.foo", "obj['foo']")).toBe(true)

    expect(exprEqual("a.b.c", "a.b.c")).toBe(true)
    expect(exprEqual("a.b.c", "a.b.d")).toBe(false)
    expect(exprEqual("a.b.c", "a.x.c")).toBe(false)

    expect(exprEqual("obj.foo", "obj?.foo")).toBe(false)
    expect(exprEqual("obj?.foo", "obj?.foo")).toBe(true)

    expect(exprEqual("obj.foo as any", "obj.foo")).toBe(true)
    expect(exprEqual("obj.foo!", "obj.foo")).toBe(true)
    expect(exprEqual("obj.foo satisfies T", "obj.foo")).toBe(true)
    expect(exprEqual("<T>obj.foo", "obj.foo")).toBe(true)

    expect(exprEqual("(obj as any).foo", "obj.foo")).toBe(true)
    expect(exprEqual("(obj!).foo", "obj.foo")).toBe(true)
    expect(exprEqual("(obj satisfies T).foo", "obj.foo")).toBe(true)

    expect(exprEqual("1", "1")).toBe(false)
    expect(exprEqual("foo()", "foo()")).toBe(false)
})

test("Function: isLeftValue", () => {
    expect(isLeftValue(expr("obj.foo"))).toBe(true)
    expect(isLeftValue(expr("obj.foo.bar"))).toBe(true)
    expect(isLeftValue(expr("foo"))).toBe(true)
    expect(isLeftValue(expr("undefined"))).toBe(false)
    expect(isLeftValue(expr("1"))).toBe(false)
    expect(isLeftValue(expr("foo()"))).toBe(false)
    expect(isLeftValue(expr("null"))).toBe(false)
    expect(isLeftValue(expr("obj.foo as any"))).toBe(true)
    expect(isLeftValue(expr("foo as any"))).toBe(true)
    expect(isLeftValue(expr("foo!"))).toBe(true)
    expect(isLeftValue(expr("undefined as any"))).toBe(false)
})

test("Function: is", () => {
    expect(is(expr("foo"), "Identifier")).toBe(true)
    expect(is(expr("obj.foo"), "MemberExpression")).toBe(true)
    expect(is(expr("foo()"), "CallExpression")).toBe(true)
    expect(is(expr("foo"), "MemberExpression")).toBe(false)
    expect(is(expr("obj.foo"), "Identifier")).toBe(false)
    expect(is(undefined, "Identifier")).toBe(false)
})

test("Function: isTypeOperation", () => {
    expect(isTypeOperation(expr("foo as any"))).toBe(true)
    expect(isTypeOperation(expr("<T>foo"))).toBe(true)
    expect(isTypeOperation(expr("foo!"))).toBe(true)
    expect(isTypeOperation(expr("foo satisfies T"))).toBe(true)

    expect(isTypeOperation(expr("foo"))).toBe(false)
    expect(isTypeOperation(expr("obj.foo"))).toBe(false)
    expect(isTypeOperation(expr("1"))).toBe(false)
    expect(isTypeOperation(expr("foo()"))).toBe(false)
})

test("Function: isLiteral", () => {
    expect(isLiteral(expr("null"))).toBe(true)
    expect(isLiteral(expr('"foo"'))).toBe(true)
    expect(isLiteral(expr("1"))).toBe(true)
    expect(isLiteral(expr("true"))).toBe(true)
    expect(isLiteral(expr("false"))).toBe(true)
    expect(isLiteral(expr("`foo`"))).toBe(true)
    expect(isLiteral(expr("1n"))).toBe(true)
    expect(isLiteral(expr("/foo/"))).toBe(true)

    // Identifier "undefined" 视为字面量
    // Identifier "undefined" is considered a literal
    expect(isLiteral(expr("undefined"))).toBe(true)

    // 普通标识符 → false
    // Ordinary identifiers → false
    expect(isLiteral(expr("foo"))).toBe(false)
    expect(isLiteral(expr("foo()"))).toBe(false)

    // SequenceExpression：取最后一项判断
    // SequenceExpression: take the last item for judgment
    expect(isLiteral(expr("(1, 2, 3)"))).toBe(true)
    expect(isLiteral(expr("(1, foo)"))).toBe(false)

    // node 为 undefined → true（node?.type === undefined 命中 case undefined）
    // node is undefined → true (node?.type === undefined hits case undefined)
    expect(isLiteral(undefined)).toBe(true)
})

test("Function: isInlineEventHandler", () => {
    // 非内联事件处理器
    // Non-inline event handlers
    expect(isInlineEventHandler(expr("foo"))).toBe(false)
    expect(isInlineEventHandler(expr("obj.foo"))).toBe(false)
    expect(isInlineEventHandler(expr("function() {}"))).toBe(false)
    expect(isInlineEventHandler(expr("() => {}"))).toBe(false)
    expect(isInlineEventHandler(expr("obj?.foo"))).toBe(false)

    // 内联事件处理器（其他表达式类型）
    // Inline event handlers (other expression types)
    expect(isInlineEventHandler(expr("foo()"))).toBe(true)
    expect(isInlineEventHandler(expr("1 + 2"))).toBe(true)
    expect(isInlineEventHandler(expr("foo++"))).toBe(true)

    // 类型操作被剥离后判断底层节点
    // Type operations are stripped and then the underlying nodes are judged
    expect(isInlineEventHandler(expr("foo as any"))).toBe(false)
    expect(isInlineEventHandler(expr("obj.foo!"))).toBe(false)
})

test("Function: isBlock", () => {
    // BlockStatement
    expect(isBlock(stmt("{}"))).toBe(true)

    // TSModuleBlock（namespace 声明的 body）
    // TSModuleBlock (body of a namespace declaration)
    expect(isBlock(stmt("namespace Foo {}").body)).toBe(true)

    // 其他节点 → false
    // Other nodes → false
    expect(isBlock(expr("foo"))).toBe(false)
    expect(isBlock(expr("1"))).toBe(false)
    expect(isBlock(stmt("const x = 1"))).toBe(false)
})

test("Function: isUndefinedLiteral", () => {
    expect(isUndefinedLiteral(expr("undefined"))).toBe(true)
    expect(isUndefinedLiteral(expr("foo"))).toBe(false)
    expect(isUndefinedLiteral(expr("1"))).toBe(false)
    expect(isUndefinedLiteral(expr("null"))).toBe(false)
})

test("Function: isContextPattern", () => {
    // undefined → true
    expect(isContextPattern(undefined)).toBe(true)

    // Identifier → true
    expect(isContextPattern(expr("foo"))).toBe(true)

    // ArrayPattern（箭头函数参数）→ true
    expect(isContextPattern(expr("([foo]) => {}").params[0])).toBe(true)

    // ObjectPattern（箭头函数参数）→ true
    expect(isContextPattern(expr("({foo}) => {}").params[0])).toBe(true)

    // RestElement（数组模式中的展开元素）→ true
    expect(isContextPattern(expr("([...foo]) => {}").params[0].elements[0])).toBe(true)

    // 其他节点类型 → false
    // Other node types → false
    expect(isContextPattern(expr("1"))).toBe(false)
    expect(isContextPattern(expr("foo()"))).toBe(false)
    expect(isContextPattern(expr("obj.foo"))).toBe(false)
})

test("Function: isIntrinsicCall", () => {
    expect(isIntrinsicCall(expr("foo()"))).toBe(true) // CallExpression
    expect(isIntrinsicCall(expr("foo?.()"))).toBe(true) // OptionalCallExpression
    expect(isIntrinsicCall(expr("foo"))).toBe(false)
    expect(isIntrinsicCall(expr("obj.foo"))).toBe(false)
    expect(isIntrinsicCall(undefined)).toBe(false)
})

test("Function: willModuleDeclarationEmitsJS", () => {
    // 空 namespace → false
    // Empty namespace → false
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo {}"))).toBe(false)

    // declare namespace → false（declare 标记）
    // declare namespace → false (declare flag)
    expect(willModuleDeclarationEmitsJS(stmt("declare namespace Foo {}"))).toBe(false)

    // declare module "foo" → false（id 为 StringLiteral）
    // declare module "foo" → false (id is StringLiteral)
    expect(willModuleDeclarationEmitsJS(stmt('declare module "foo" {}'))).toBe(false)

    // 只有类型声明 → false
    // Only type declarations → false
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { type Bar = string }"))).toBe(false)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { interface Bar {} }"))).toBe(false)

    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { export type Bar = string }"))).toBe(
        false
    )
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { class Bar {} }"))).toBe(true)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { enum Bar {} }"))).toBe(true)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { const x = 1 }"))).toBe(true)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { function f() {} }"))).toBe(true)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo { export const x = 1 }"))).toBe(true)

    // 点号嵌套 namespace（body 为 TSModuleDeclaration，递归）
    // Dot-nested namespace (body is TSModuleDeclaration, recursive)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo.Bar { class Baz {} }"))).toBe(true)
    expect(willModuleDeclarationEmitsJS(stmt("namespace Foo.Bar { type Baz = string }"))).toBe(
        false
    )
})

test("Function: isFunctionLiteral", () => {
    expect(isFunctionLiteral(expr("function() {}"))).toBe(true)
    expect(isFunctionLiteral(expr("function foo() {}"))).toBe(true)
    expect(isFunctionLiteral(expr("() => {}"))).toBe(true)
    expect(isFunctionLiteral(expr("x => x"))).toBe(true)
    expect(isFunctionLiteral(expr("foo"))).toBe(false)
    expect(isFunctionLiteral(expr("1"))).toBe(false)
    expect(isFunctionLiteral(expr("foo()"))).toBe(false)

    // null / undefined → falsy
    expect(isFunctionLiteral(undefined)).toBeFalsy()
    expect(isFunctionLiteral(null)).toBeFalsy()
})
