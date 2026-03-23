import type {
    Node,
    Identifier,
    Program,
    PatternLike,
    ClassMethod,
    RestElement,
    TSModuleBlock,
    ObjectMethod,
    ArrayPattern,
    ObjectPattern,
    ClassDeclaration,
    BlockStatement,
    CallExpression,
    ClassPrivateMethod,
    TSEnumDeclaration,
    VariableDeclarator,
    FunctionExpression,
    FunctionDeclaration,
    VariableDeclaration,
    OptionalCallExpression,
    ArrowFunctionExpression
} from "@babel/types"
import { EstreeWalkContext } from "#type-declarations/compiler"
import type { RequiredNonNullableKeys } from "#type-declarations/tools"

export type TopLevelDeclarationNode =
    | VariableDeclaration
    | FunctionDeclaration
    | ClassDeclaration
    | TSEnumDeclaration

export type FunctionNode =
    | ObjectMethod
    | ClassMethod
    | ClassPrivateMethod
    | FunctionExpression
    | FunctionDeclaration
    | ArrowFunctionExpression

export type TopLevelDeclaratorNode =
    | VariableDeclarator
    | Exclude<TopLevelDeclarationNode, VariableDeclaration>

export type StrictArrayPattern = Omit<ArrayPattern, "elements"> & {
    elements: Array<PatternLike>
}

export type WithLoc<T extends AnyNode> = RequiredNonNullableKeys<
    T,
    "start" | "end" | "loc" | "range"
>
export type Visitor = {
    AnyNode?: VisitorTrapFunc<AnyNode>
} & {
    [K in AnyNode["type"]]?: VisitorTrapFunc<Extract<AnyNode, { type: K }>>
}

export type AnyNode = Node
export type ScopeContext = EstreeWalkContext<ScopeNode>
export type PartialAnyNode = Node | undefined | null
export type DeclarationKind = VariableDeclaration["kind"] | ""
export type ScopeNode = BlockStatement | TSModuleBlock | Program
export type IntrinsicCall = CallExpression | OptionalCallExpression
export type WalkPatternCallback = (identifier: WithLoc<Identifier>, path: string) => void
export type ContextPattern = Identifier | ObjectPattern | ArrayPattern | RestElement | null

type VisitorTrapFunc<T extends AnyNode> = (node: WithLoc<T>, context: EstreeWalkContext<T>) => void
