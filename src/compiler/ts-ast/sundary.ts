import ts from "typescript"

export function getSyntaxKindByNode(node: ts.Node) {
    return ts.SyntaxKind[node.kind]
}

export function getSyntaxKindName(kind: ts.SyntaxKind) {
    return ts.SyntaxKind[kind]
}
