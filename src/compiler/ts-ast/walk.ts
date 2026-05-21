import ts from "typescript"

export function walkTsAst(node: ts.Node, callback: (node: ts.Node) => boolean | void) {
    if (callback(node) === false) {
        return false
    }
    for (const child of node.getChildren()) {
        if (walkTsAst(child, callback) === false) {
            return false
        }
    }
}
