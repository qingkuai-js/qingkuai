import type {
    Node,
    Pattern,
    Identifier,
    Expression,
    RestElement,
    TSAsExpression,
    TSTypeAssertion,
    MemberExpression,
    TSNonNullExpression,
    TSSatisfiesExpression
} from "@babel/types"
import { ASTLocation } from "../types"

export type AnyNode = Node

export type RequiredPosition = {
    end: number
    start: number
    loc: ASTLocation
}

export interface TraverseParent {
    v: PartialAnyNode
    excludes: Set<string>
    parent: TraverseParent | null
}

export type TypeOperationExpression =
    | TSAsExpression
    | TSTypeAssertion
    | TSNonNullExpression
    | TSSatisfiesExpression

export type PartialBase = undefined | null
export type PartialAnyNode = AnyNode | PartialBase
export type PartialPattern = EsPattern | PartialBase
export type PartialExpression = Expression | PartialBase
export type AnyNodeWithStartEnd = AnyNode & RequiredPosition
export type EsPattern = Pattern | Identifier | RestElement | MemberExpression

export type ASTVisitor = {
    AnyNode?: ASTVisitorFn<AnyNode>
} & {
    [K in AnyNode["type"]]?: ASTVisitorFn<Extract<AnyNode, { type: K }>>
}
export type ASTVisitorFn<T> = (node: T & RequiredPosition, parent: TraverseParent) => void

export type WalkPatternArr = (string | [number, number])[] | undefined
export type WalkPatternCallback = (node: Identifier, path: WalkPatternArr) => void
