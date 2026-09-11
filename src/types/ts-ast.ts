import type TS from "typescript"

export type ScopeBoundary =
    | TS.SourceFile
    | TS.ModuleBlock
    | TS.Block
    | TS.CaseClause
    | TS.ConciseBody

export type NamedNode =
    | TS.ParameterDeclaration
    | TS.GetAccessorDeclaration
    | TS.SetAccessorDeclaration
    | TS.ClassExpression
    | TS.FunctionExpression
    | TS.EnumDeclaration
    | TS.ModuleDeclaration
    | TS.ClassDeclaration
    | TS.MethodDeclaration
    | TS.VariableDeclaration
    | TS.PropertyDeclaration
    | TS.FunctionDeclaration
    | TS.PropertyAssignment
    | TS.ImportEqualsDeclaration
    | TS.PropertyAccessExpression

export type TopLevelDeclarationNode =
    | TS.VariableDeclarationList
    | TS.FunctionDeclaration
    | TS.ClassDeclaration
    | TS.EnumDeclaration

export type TopLevelDeclaratorNode =
    | TS.VariableDeclaration
    | Exclude<TopLevelDeclarationNode, TS.VariableDeclarationList>

export type TsNodeWithContext<T extends TS.Node = TS.Node> = T & {
    inTopLevel: boolean
    isScopeBoundary: boolean
    isBindingReference: boolean
    parent: TsNodeWithContext | null
    isNonHoistableScopeBoundary: boolean
    scopeIdentifiers: Set<string> | undefined
}

export type FindNodesPredicate<T extends TS.Node> = (node: TS.Node) => node is T
export type ForStatementLike = TS.ForStatement | TS.ForInStatement | TS.ForOfStatement
