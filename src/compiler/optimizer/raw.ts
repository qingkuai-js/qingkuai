import type { Range } from "#type-declarations/compiler"

import ts from "typescript"

import { getStriptTypeOperationsNode } from "../ts-ast/sundry"

// raw(标识符) 的 toRaw 优化：实参为独立标识符时，noTracking 包裹可简化为
// toRaw(标识符)——非追踪的解包由 toRaw 完成，避免闭包与追踪栈开销。
// The toRaw optimization for raw(identifier): when the argument is a standalone
// identifier, the noTracking wrapper can be simplified to toRaw(identifier) — the
// untracked unwrapping is done by toRaw, avoiding closure and tracking-stack overhead.
//
// 返回实参标识符的区间（重写时以裸名字替换 ".$" 访问器形式），不可优化返回 undefined。
// Returns the range of the argument identifier (used to replace the ".$" accessor
// form with the bare name during the rewrite), or undefined when not optimizable.
//
// 待办: 链式实参（raw(a.b) → toRaw(a).b）等更多形态在优化器中后续支持。
// TO-DO: more shapes, such as chained arguments (raw(a.b) → toRaw(a).b), will be supported
// in the optimizer later.
export function getRawToRawArgumentRange(call: ts.CallExpression): Range | undefined {
    if (call.arguments.length !== 1 || ts.isSpreadElement(call.arguments[0])) {
        return undefined
    }

    const identifier = getStriptTypeOperationsNode(call.arguments[0])
    return ts.isIdentifier(identifier) ? [identifier.getStart(), identifier.getEnd()] : undefined
}
