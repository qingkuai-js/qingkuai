import type {
    TsNodeWithContext,
    TopLevelDeclaratorNode,
    TopLevelDeclarationNode
} from "#type-declarations/ts-ast"
import type { TopLevelIdentifierNodeInfo } from "#type-declarations/compiler"
import type { Range, IdentifierStatus, ReactiveIntrinsics } from "#type-declarations/compiler"

import ts from "typescript"

import {
    indentSpacesRE,
    intrinsicMethodsRE,
    intrinsicVariableRE,
    cannotRedeclareStatusRE,
    intrinsicWatcherMethodsRE,
    intrinsicReactiveMethodsRE
} from "../regular"
import {
    CannotAliasIdentifier,
    AmbiguousReactiveMarking,
    TopLevelAwaitNotBeSupported,
    UsedForbiddenIdentifierFormat,
    IdentifierCannotBeRedeclared,
    InvalidUsageForIntrinsicMethods,
    ShadowCompilerIntrinsicAtTopLevel,
    InvalidParameterForAliasIntrinsic,
    InvalidSpreadElementArgForIntrinsic,
    TSModuleDeclarationsAreNotSupported,
    InvalidAliasDestructuringDeclaration,
    IntrinsicNotAllowedInUsingDeclaration
} from "../message/error"
import {
    RedundantRawMark,
    UnnecessaryReactiveMark,
    RedundantArgsForIntrinsic,
    IdentifierMaybeOverwritten,
    DuplicateDefaultDeclaration,
    DeclareDerivedMixedSyntaticForms,
    UnnecessaryMutableDerivedDeclaration
} from "../message/warn"
import {
    getNodeRange,
    markNeedSourcemap,
    getVariableDeclareKeyword,
    getStriptTypeOperationsNode,
    getStriptTypeOperationsParent
} from "../ts-ast/sundry"
import {
    isLiteral,
    isLeftValue,
    isTypeOperation,
    isFunctionLiteral,
    isIdentifierAssignmentTarget
} from "../ts-ast/assert"
import { analyzeExports } from "./exports"
import { PRESERVED_IDPREFIX } from "../constants"
import { stringify } from "../../util/shared/aliases"
import { getLastElem } from "../../util/shared/arrays"
import { isInHoistableTopLevel } from "../ts-ast/context"
import { analyzeResult, inputDescriptor } from "../state"
import { parseExpression, parseScript } from "../parser/script"
import { getScriptLocByNode } from "../../util/compiler/position"
import { collectReusedStringReference } from "../optimizer/compress"
import { walkAncestors, walkBindingNameIdentifiers, walkTsNodeWithContext } from "../ts-ast/walk"

export function analyzeScript() {
    if (!inputDescriptor.script.existing) {
        return
    }

    const sourceCode = inputDescriptor.script.code
    const sourceFile = parseScript(sourceCode)
    const startSourceIndex = inputDescriptor.script.loc.start.index
    if (sourceFile) {
        analyzeExports(sourceFile)
        analyzeSourceFile(sourceFile)
        markNeedSourcemap(sourceFile, startSourceIndex)
    }
    inputDescriptor.indent = indentSpacesRE.exec(sourceCode)?.[0] ?? "  "
}

function analyzeSourceFile(sourceFile: ts.SourceFile) {
    walkTsNodeWithContext(sourceFile, node => {
        markNeedSourcemap(node, inputDescriptor.script.loc.start.index)
        collectReusedStringReference(node, analyzeResult.script.reusedStringReferences)

        if (ts.isIdentifier(node)) {
            analyzeIdentifier(node as TsNodeWithContext<ts.Identifier>)
            return
        }

        if (ts.isVariableDeclarationList(node)) {
            analyzeVariableDeclarationList(node as TsNodeWithContext<ts.VariableDeclarationList>)
            return
        }

        // 记录监视器便捷注册方法的调用位置
        // Record the call locations of intrinsic watcher registration methods.
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            intrinsicWatcherMethodsRE.test(node.expression.text)
        ) {
            analyzeResult.script.watchers.push(node)
            return
        }

        if (node.inTopLevel) {
            switch (node.kind) {
                case ts.SyntaxKind.AwaitExpression: {
                    TopLevelAwaitNotBeSupported(getScriptLocByNode(node))
                    return
                }

                case ts.SyntaxKind.ModuleDeclaration: {
                    TSModuleDeclarationsAreNotSupported(getScriptLocByNode(node))
                    return
                }

                case ts.SyntaxKind.EnumDeclaration: {
                    const enumDeclaration = node as TsNodeWithContext<ts.EnumDeclaration>
                    updateTopLevelIdentifiers(
                        enumDeclaration.name,
                        false,
                        true,
                        "pending",
                        enumDeclaration,
                        enumDeclaration
                    )
                    return
                }

                case ts.SyntaxKind.ClassDeclaration: {
                    const classDeclaration = node as TsNodeWithContext<ts.ClassDeclaration>
                    if (classDeclaration.name) {
                        updateTopLevelIdentifiers(
                            classDeclaration.name,
                            false,
                            true,
                            "literal",
                            classDeclaration,
                            classDeclaration
                        )
                    }
                    return
                }

                case ts.SyntaxKind.FunctionDeclaration: {
                    const functionDeclaration = node as TsNodeWithContext<ts.FunctionDeclaration>
                    if (functionDeclaration.name) {
                        updateTopLevelIdentifiers(
                            functionDeclaration.name,
                            true,
                            true,
                            "literal",
                            functionDeclaration,
                            functionDeclaration
                        )
                    }
                    return
                }

                case ts.SyntaxKind.ImportDeclaration: {
                    const importDeclaration = node as TsNodeWithContext<ts.ImportDeclaration>
                    const phaseModifier = importDeclaration.importClause?.phaseModifier
                    analyzeResult.script.importDeclarations.push(importDeclaration)

                    // import type ...
                    if (phaseModifier && phaseModifier === ts.SyntaxKind.TypeKeyword) {
                        return
                    }

                    if (importDeclaration.importClause?.name) {
                        checkTopLevelIdentifier(importDeclaration.importClause.name, true)
                        return
                    }

                    const namedBindings = importDeclaration.importClause?.namedBindings
                    if (!namedBindings) {
                        return
                    }
                    if (ts.isNamespaceImport(namedBindings)) {
                        checkTopLevelIdentifier(namedBindings.name, true)
                        return
                    }
                    for (const specifier of namedBindings.elements) {
                        if (specifier.isTypeOnly) {
                            continue
                        }
                        checkTopLevelIdentifier(specifier.name, true)
                    }
                    return
                }

                case ts.SyntaxKind.ImportEqualsDeclaration: {
                    const importEqualsDeclaration =
                        node as TsNodeWithContext<ts.ImportEqualsDeclaration>
                    checkTopLevelIdentifier(importEqualsDeclaration.name, true)
                    analyzeResult.script.importDeclarations.push(importEqualsDeclaration)
                    return
                }
            }
        }
    })
}

function analyzeIdentifier(node: TsNodeWithContext<ts.Identifier>) {
    analyzeResult.script.fullIdentifiers.add(node.text)

    if (node.text.startsWith(PRESERVED_IDPREFIX)) {
        UsedForbiddenIdentifierFormat(getScriptLocByNode(node))
    }

    // 记录所有引用顶部标识符的位置信息
    // Record the source ranges of all references to top-level identifiers.
    if (!node.scopeIdentifiers?.has(node.text) && node.isBindingReference) {
        const nodeRange: Range = getNodeRange(node)
        const { preMutatedTopLevelIdentifiers } = analyzeResult.script
        const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[node.text]
        ;(analyzeResult.script.topLevelReferences[node.text] ??= []).push({
            range: nodeRange,
            declared: !!topLevelIdentifier,
            shorthand: ts.isShorthandPropertyAssignment(node.parent)
        })

        if (intrinsicVariableRE.test(node.text)) {
            analyzeResult.script.usedIntrinsicVars.add(node.text)
        }

        // 提前记录被修改的顶级标识符，以便在后续分析中正确推断其响应性状态
        // Record mutated top-level identifiers in advance to
        // correctly infer their reactive status in subsequent analysis.
        if (
            // prettier-ignore
            (
                topLevelIdentifier?.status === "literal" ||
                (!topLevelIdentifier && !preMutatedTopLevelIdentifiers.has(node.text))
            ) &&
            isIdentifierAssignmentTarget(node)
        ) {
            if (topLevelIdentifier) {
                topLevelIdentifier.status = "pending"
            } else {
                preMutatedTopLevelIdentifiers.add(node.text)
            }
        }

        if (intrinsicMethodsRE.test(node.text)) {
            checkUsageOfIntrinsicMethods(node)
        }
    }
}

function analyzeVariableDeclarationList(node: TsNodeWithContext<ts.VariableDeclarationList>) {
    const declareKeyword = getVariableDeclareKeyword(node)
    if (declareKeyword === "var" ? !isInHoistableTopLevel(node) : !node.inTopLevel) {
        return
    }

    const isCheckMode = inputDescriptor.options.checkMode
    const topLevelIdentifiers = analyzeResult.script.topLevelIdentifiers
    const declaratorToAliasInfos = analyzeResult.script.declaratorToAliasInfos
    for (const declaration of node.declarations) {
        const status = inferStatusByVariableDeclaration(declaration, node)
        const destructuringIdentifierNames: string[] | undefined = ts.isIdentifier(declaration.name)
            ? undefined
            : []
        const patternInfo = walkBindingNameIdentifiers(declaration.name, (identifier, path) => {
            const initNode = declaration.initializer

            // `let/var` 声明对衍生响应式值无意义，它不可被修改
            // `let/var` declarations are meaningless for derived reactive values, as they cannot be reassigned.
            if (status === "derived" && (declareKeyword === "var" || declareKeyword === "let")) {
                UnnecessaryMutableDerivedDeclaration(getScriptLocByNode(declaration))
            }

            // 衍生响应式值/别名 标识符不能重复声明（使用 `var` 关键字时可能导致此问题）
            // Derived reactive value or alias identifiers must not be declared more than once (this may occur when using the `var` keyword).
            if (topLevelIdentifiers[identifier.text]) {
                const existing = topLevelIdentifiers[identifier.text]
                const existingCannotBeRedeclared = cannotRedeclareStatusRE.test(existing.status)
                if (existingCannotBeRedeclared || cannotRedeclareStatusRE.test(status)) {
                    if (existingCannotBeRedeclared) {
                        IdentifierCannotBeRedeclared(
                            getScriptLocByNode(identifier),
                            existing!.status
                        )
                    } else {
                        IdentifierCannotBeRedeclared(
                            getScriptLocByNode(getLastElem(existing.nodeInfos)!.id),
                            status
                        )
                    }
                }
            }

            const hoist = declareKeyword === "var"
            const implicit = status === "pending" || status === "literal"
            updateTopLevelIdentifiers(
                identifier,
                hoist,
                implicit,
                status,
                declaration,
                node,
                destructuringIdentifierNames
            )

            // status 为 alias 时记录标识符别名的访问路径
            // When the status is `alias`, record the access path of the identifier alias.
            if (
                initNode &&
                status === "alias" &&
                ts.isCallExpression(initNode) &&
                initNode.arguments.length &&
                isLeftValue(initNode.arguments[0])
            ) {
                let aliasProperty: string | undefined
                let aliasExpression: string | undefined
                let aliasInfos = declaratorToAliasInfos.get(declaration)
                const firstArg = getStriptTypeOperationsNode(initNode.arguments[0])!
                if (!isCheckMode) {
                    if (!destructuringIdentifierNames) {
                        if (ts.isElementAccessExpression(firstArg)) {
                            aliasExpression = firstArg.expression.getText()
                            aliasProperty = firstArg.argumentExpression.getText()
                        } else if (
                            ts.isPropertyAccessExpression(firstArg) &&
                            ts.isIdentifier(firstArg.name)
                        ) {
                            aliasProperty = stringify(firstArg.name.text)
                            aliasExpression = firstArg.expression.getText()
                        }
                    } else if (path) {
                        const pathExp = parseExpression("_" + path, 0)!
                        if (ts.isElementAccessExpression(pathExp)) {
                            aliasExpression = pathExp.expression.getText()
                            aliasProperty = pathExp.argumentExpression.getText()
                        } else if (
                            ts.isPropertyAccessExpression(pathExp) &&
                            ts.isIdentifier(pathExp.name)
                        ) {
                            aliasExpression = pathExp.expression.getText()
                            aliasProperty = stringify(pathExp.name.getText())
                        }

                        // 添加 alias 内建方法参数并去除路径表达式前缀下划线
                        // Add the argument of the alias intrinsic method and
                        // remove the underscore prefix from the path expression.
                        if (aliasExpression) {
                            aliasExpression = firstArg.getText() + aliasExpression.slice(1)
                        }
                    }
                    if (!aliasInfos) {
                        declaratorToAliasInfos.set(declaration, (aliasInfos = []))
                    }
                    if (aliasExpression && aliasProperty) {
                        aliasInfos.push({
                            property: aliasProperty,
                            expression: aliasExpression
                        })
                    }
                }
                topLevelIdentifiers[identifier.text].aliasTarget = firstArg.getText() + path
            }

            // 记录解构声明的标识符名称列表
            // Record the list of identifier names declared by a destructuring declaration.
            for (const nodeInfo of topLevelIdentifiers[identifier.text].nodeInfos) {
                nodeInfo.destructuringIdentifierNames = destructuringIdentifierNames
                destructuringIdentifierNames?.push(identifier.text)
            }
        })

        // 别名绑定搭配解构语法时不允许指定默认值或剩余元素语法
        // Alias bindings are not allowed to specify default values or use rest elements when combined with destructuring syntax.
        if (status === "alias") {
            const errorLoc = getScriptLocByNode(declaration)
            if (!inputDescriptor.options.debug) {
                if (node.declarations.length === 1) {
                    analyzeResult.script.eliminatedNodes.add(node)
                } else {
                    analyzeResult.script.eliminatedNodes.add(declaration)
                }
            }
            if (patternInfo.hasRestElement) {
                InvalidAliasDestructuringDeclaration(errorLoc, "Rest elements")
            }
            if (patternInfo.specifiedDefaultValue) {
                InvalidAliasDestructuringDeclaration(errorLoc, "Default values")
            }
        }
    }
}

// 推断顶级作用域标识符的响应式状态
// Infer the reactive status of top-level scope identifiers.
function inferStatusByVariableDeclaration(
    declaration: ts.VariableDeclaration,
    declarationList: ts.VariableDeclarationList
): IdentifierStatus {
    const declareKeyword = getVariableDeclareKeyword(declarationList)
    if (declareKeyword === "using") {
        return "raw"
    }

    const isShorthandDerived =
        ts.isIdentifier(declaration.name) &&
        declaration.name.text.startsWith("$") &&
        inputDescriptor.options.shorthandDerivedDeclaration
    const isConst = declareKeyword === "const"
    const declarationLoc = getScriptLocByNode(declaration)
    const isDestructuring = !ts.isIdentifier(declaration.name)
    const initNode = declaration.initializer && getStriptTypeOperationsNode(declaration.initializer)

    if (!initNode) {
        return isConst ? "raw" : "literal"
    }

    if (!ts.isCallExpression(initNode)) {
        const isLiteralInit = isLiteral(initNode)
        if (isShorthandDerived) {
            if (!isLiteralInit) {
                return "derived"
            }

            // 初始值为字面量值的简写衍生响应式声明无意义，退化为使用原始值
            // Shorthand derived reactive declarations with literal initial values are meaningless and are downgraded to using the raw value.
            return (UnnecessaryReactiveMark(declarationLoc, "derived"), "raw")
        }

        // 初始值为字面量值的常量声明不具有响应式意义，退化为使用原始值
        // Constant declarations with literal initial values have no reactive semantics and are downgraded to using the raw value.
        if (!isDestructuring && (isLiteralInit || isFunctionLiteral(initNode))) {
            return isConst ? "raw" : "literal"
        }

        return "pending"
    }

    const callee = getStriptTypeOperationsNode(initNode.expression)!
    if (!ts.isIdentifier(callee)) {
        return "pending"
    }

    const calleeName = callee.text
    if (!intrinsicReactiveMethodsRE.test(calleeName)) {
        return "pending"
    }

    // 检查是否混用了简洁衍生响应式声明语法和标记响应式声明语法
    // Check whether concise derived reactive declarations and marked reactive declarations are mixed.
    if (isShorthandDerived) {
        if (calleeName === "derived" || calleeName === "derivedExp") {
            DeclareDerivedMixedSyntaticForms(declarationLoc)
        } else {
            AmbiguousReactiveMarking(declarationLoc, calleeName)
        }
    }

    const firstArg = initNode.arguments[0]
    const isLiteralArg = !firstArg || isLiteral(firstArg)
    switch (calleeName) {
        case "alias": {
            return "alias"
        }

        case "derived":
        case "derivedExp": {
            if (isLiteralArg) {
                // 初始值为字面量值的简写衍生响应式声明无意义，退化为使用原始值
                // Shorthand derived reactive declarations with literal initial values are meaningless and are downgraded to using the raw value.
                return (UnnecessaryReactiveMark(declarationLoc, "derived"), "raw")
            }
            return "derived"
        }

        default: {
            if (isShorthandDerived) {
                return "derived"
            }

            const status = calleeName as ReactiveIntrinsics
            if (isDestructuring || !isConst || !(isLiteralArg || isFunctionLiteral(firstArg))) {
                return status
            }

            // 通过 raw 标记常量声明的字面量值是冗余的
            // Marking a literal value in a constant declaration with `raw` is redundant.
            if (calleeName === "raw") {
                return (RedundantRawMark(declarationLoc), "raw")
            }

            // 通过 reactive 或 shallow 标记常量声明的字面量值是无意义的，退化为使用原始值
            // Marking a literal value in a constant declaration with `reactive` or `shallow` is meaningless and is downgraded to using the raw value.
            return (UnnecessaryReactiveMark(declarationLoc, status), "raw")
        }
    }
}

// 更新顶级作用域标识符信息
// Update top-level scope identifier information.
function updateTopLevelIdentifiers(
    id: ts.Identifier,
    hoist: boolean,
    implicit: boolean,
    status: IdentifierStatus,
    declarator: TopLevelDeclaratorNode,
    declaration: TopLevelDeclarationNode,
    destructuringIdentifierNames?: string[]
) {
    const nodeInfo: TopLevelIdentifierNodeInfo = {
        id,
        declarator,
        declaration,
        destructuringIdentifierNames
    }
    const existing = analyzeResult.script.topLevelIdentifiers[id.text]
    if (status === "literal" && analyzeResult.script.preMutatedTopLevelIdentifiers.has(id.text)) {
        status = "pending"
    }
    if (existing) {
        if (status !== "pending" && status !== "literal") {
            existing.status = status
            existing.implicit = false
        }
        if (existing.status === "literal") {
            existing.status = "pending"
        }
        existing.nodeInfos.push(nodeInfo)
    } else {
        let accessor: boolean
        if (!(accessor = !ts.isVariableDeclarationList(declaration))) {
            switch (status) {
                case "derived": {
                    accessor = true
                    break
                }
                case "alias": {
                    accessor = !inputDescriptor.options.debug
                    break
                }
                default: {
                    const declareKeyword = getVariableDeclareKeyword(declaration)
                    accessor = declareKeyword === "var" || declareKeyword === "let"
                    break
                }
            }
        }
        analyzeResult.script.topLevelIdentifiers[id.text] = {
            status,
            hoist,
            implicit,
            accessor,
            aliasTarget: "",
            transformTo: "",
            nodeInfos: [nodeInfo],
            usedExpressions: new Set()
        }
    }
    checkTopLevelIdentifier(id)
}

// 检查顶级作用域标识符格式
// Validate top-level scope identifier formatting.
function checkTopLevelIdentifier(id: ts.Identifier, imported = false) {
    const sourceLoc = getScriptLocByNode(id)
    if (imported) {
        analyzeResult.script.importIdentifiers.add(id.text)
    }
    if (id.text === "$arg") {
        IdentifierMaybeOverwritten(sourceLoc, id.text, "inline event handler")
    }
    if (intrinsicMethodsRE.test(id.text) || intrinsicVariableRE.test(id.text)) {
        ShadowCompilerIntrinsicAtTopLevel(sourceLoc, id.text)
    }
}

// 检查编译器内置方法的使用是否合法
// Validate the usage of compiler intrinsic methods.
function checkUsageOfIntrinsicMethods(node: TsNodeWithContext<ts.Identifier>) {
    const intrinsicName = node.text
    const parent = getStriptTypeOperationsParent(node)!
    if (ts.isCallExpression(parent)) {
        const firstArg = parent.arguments[0]
        const argsLen = parent.arguments.length
        const intrinsicCallLoc = getScriptLocByNode(parent)
        switch (intrinsicName) {
            case "watchExp":
            case "preWatchExp":
            case "postWatchExp":
            case "syncWatchExp": {
                if (argsLen > 2) {
                    RedundantArgsForIntrinsic(intrinsicCallLoc, intrinsicName, 2, argsLen)
                }
                return
            }

            case "defaultRefs":
            case "defaultProps": {
                if (!parent.inTopLevel) {
                    break
                }
                if (!inputDescriptor.options.checkMode) {
                    analyzeResult.script.eliminatedNodes.add(parent)
                }
                if (argsLen > 1) {
                    RedundantArgsForIntrinsic(intrinsicCallLoc, intrinsicName, 1, argsLen)
                }
                if (firstArg && ts.isSpreadElement(firstArg)) {
                    InvalidSpreadElementArgForIntrinsic(getScriptLocByNode(firstArg), intrinsicName)
                }

                let isValidDefinition = true
                walkAncestors(parent, current => {
                    if (
                        !isTypeOperation(current) &&
                        !ts.isSourceFile(current) &&
                        !ts.isExpressionStatement(current)
                    ) {
                        return !(isValidDefinition = false)
                    }
                })
                if (isValidDefinition) {
                    const key = intrinsicName === "defaultProps" ? "props" : "refs"
                    const existing = analyzeResult.script.defaultItems[key]
                    if (existing) {
                        DuplicateDefaultDeclaration(getScriptLocByNode(existing.intrinsicId), key)
                    }
                    if (parent.arguments.length) {
                        analyzeResult.script.defaultItems[key] = {
                            intrinsicId: node,
                            value: parent.arguments[0]
                        }
                    } else {
                        analyzeResult.script.defaultItems[key] = undefined
                    }
                    return
                }
                break
            }

            default: {
                if (firstArg && ts.isSpreadElement(firstArg)) {
                    InvalidSpreadElementArgForIntrinsic(getScriptLocByNode(firstArg), intrinsicName)
                }
                if (argsLen > 1) {
                    RedundantArgsForIntrinsic(intrinsicCallLoc, intrinsicName, 1, argsLen)
                }
                if (intrinsicName === "alias") {
                    if (parent.arguments.length !== 1 || !isLeftValue(firstArg)) {
                        InvalidParameterForAliasIntrinsic(intrinsicCallLoc)
                    }
                }

                const grandParentNode = getStriptTypeOperationsParent(parent)!
                if (parent.inTopLevel && ts.isVariableDeclaration(grandParentNode)) {
                    if (
                        firstArg &&
                        intrinsicName === "alias" &&
                        ts.isIdentifier(firstArg) &&
                        ts.isIdentifier(grandParentNode.name)
                    ) {
                        CannotAliasIdentifier(intrinsicCallLoc)
                    }

                    const declarationList = grandParentNode.parent as ts.VariableDeclarationList
                    if (getVariableDeclareKeyword(declarationList) === "using") {
                        IntrinsicNotAllowedInUsingDeclaration(
                            getScriptLocByNode(grandParentNode),
                            intrinsicName
                        )
                    } else {
                        analyzeResult.script.declaratorToIntrinsic.set(grandParentNode, node)
                    }
                    return
                }
            }
        }
    }
    InvalidUsageForIntrinsicMethods(getScriptLocByNode(node), intrinsicName)
}
