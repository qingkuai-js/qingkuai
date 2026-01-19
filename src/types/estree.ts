import type {
    Node,
    Identifier,
    Expression,
    Program,
    ClassMethod,
    TSModuleBlock,
    ObjectMethod,
    ClassDeclaration,
    BlockStatement,
    ClassPrivateMethod,
    TSEnumDeclaration,
    FunctionExpression,
    FunctionDeclaration,
    TSModuleDeclaration,
    VariableDeclaration,
    ArrowFunctionExpression
} from "@babel/types"
import type { RequiredNonNullableKeys } from "./tools"
import type { WalkContext } from "../util/compiler/estree/walk"

export type AnyNode = Node
export type PartialAnyNode = Node | undefined | null

export type TopLevelDeclarationNode =
    | VariableDeclaration
    | FunctionDeclaration
    | ClassDeclaration
    | TSEnumDeclaration
    | TSModuleDeclaration

export type FunctionNode =
    | ObjectMethod
    | ClassMethod
    | ClassPrivateMethod
    | FunctionExpression
    | FunctionDeclaration
    | ArrowFunctionExpression

export type ScopeContext = WalkContext<ScopeNode>
export type ScopeNode = BlockStatement | TSModuleBlock | Program

export type WithLoc<T extends AnyNode> = RequiredNonNullableKeys<
    T,
    "start" | "end" | "loc" | "range"
>
export type Visitor = {
    AnyNode?: VisitorTrapFunc<AnyNode>
} & {
    [K in AnyNode["type"]]?: VisitorTrapFunc<Extract<AnyNode, { type: K }>>
}

export type WalkPatternCallback = (identifier: WithLoc<Identifier>, path: string) => void

type VisitorTrapFunc<T extends AnyNode> = (node: WithLoc<T>, context: WalkContext<T>) => void
