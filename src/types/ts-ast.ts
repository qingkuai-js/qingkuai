import type ts from "typescript"

export type NamedNode =
    | ts.ParameterDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration
    | ts.ClassExpression
    | ts.FunctionExpression
    | ts.EnumDeclaration
    | ts.ModuleDeclaration
    | ts.ClassDeclaration
    | ts.MethodDeclaration
    | ts.VariableDeclaration
    | ts.PropertyDeclaration
    | ts.FunctionDeclaration
    | ts.PropertyAssignment
    | ts.ImportEqualsDeclaration
    | ts.PropertyAccessExpression

export type ContextPattern = ts.Identifier | ts.BindingPattern
export type FindNodesPredicate<T extends ts.Node> = (node: ts.Node) => node is T
export type ForStatementLike = ts.ForStatement | ts.ForInStatement | ts.ForOfStatement
export type ScopeBoundary = ts.SourceFile | ts.ModuleBlock | ts.Block | ts.CaseClause
