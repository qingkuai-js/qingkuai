import type { RuntimeCodeWriter } from "../writer";
import type { ParsedPattern, TemplateAttribute } from "#type-declarations/compiler";

import ts from "../../ts-api";

import { CodeEditor } from "../editor";
import { generateIdentifiers, inputDescriptor } from "../../state";
import { isArrayBindingNameIdentifier } from "../../ts-ast/assert";
import { getParsedDirective } from "../../../util/compiler/template";
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry";

export function writeContextDeclaration(writer: RuntimeCodeWriter, directive: TemplateAttribute) {
    const parsedDirective = getParsedDirective(directive);
    if (!parsedDirective?.context) {
        return writer;
    }

    const declaredIds: string[] = [];
    const assignedFlags: boolean[] = [];
    const destructuredIds: string[] = [];
    const destructuredFlags: boolean[] = [];
    const context = parsedDirective.context;
    const patterns = parsedDirective.patterns;
    const debugMode = inputDescriptor.options.debug;
    const multiPatterns = patterns.length > 1;
    const setterArgId = generateIdentifiers.setterArg;
    const [contextId, plainRow] = [context.argId, !!context.plainRow];
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const isIdentifier = isArrayBindingNameIdentifier(pattern.node);
        const isDestructured = !isIdentifier && !ts.isOmittedExpression(pattern.node);
        if (isDestructured) {
            destructuredIds.push(...pattern.declaredIdentifiers);
        }
        destructuredFlags.push(isDestructured);
        declaredIds.push(...pattern.declaredIdentifiers);
        assignedFlags.push(isDestructured || (debugMode && isIdentifier));
    }

    if (plainRow) {
        const letIds = debugMode ? declaredIds : destructuredIds;
        if (!letIds.length) {
            return writer;
        }
        for (let i = 0; i < patterns.length; i++) {
            if (!assignedFlags[i]) {
                continue;
            }
            if (i === 0) {
                context.rowUsesItem = true;
            } else {
                context.rowUsesIndex = true;
            }
        }

        const setterId = (context.setterId = ensureIdWithNumSuffix("_S"));
        writer.wrapLine().write(`let ${letIds.join(", ")};`);
        writer.wrapLine().write(`const ${setterId} = ${setterArgId} => (`);
        writeSetterAssignment(writer, patterns, assignedFlags, multiPatterns, false, " = ");
        writeSetterAssignment(writer, patterns, assignedFlags, multiPatterns, true, ")");
        return writer.wrapLine().write(`${setterId}(${contextId})`);
    }

    const internalId = generateIdentifiers.internal;
    const joinedDerivedIds = destructuredIds.join(", ");
    if (debugMode) {
        if (declaredIds.length) {
            writer.wrapLine().write(`let ${declaredIds.join(", ")};`);
        }
        writeIdentifierRefreshEffect(writer, patterns, contextId);
    }
    if (destructuredIds.length) {
        const derivedId = (context.derivedId = ensureIdWithNumSuffix("_dctx"));
        writer.wrapLine().write(`const ${derivedId} = ${internalId}.derived(`).indent();
        writer.write("() => {").indent(false);

        for (let i = 0; i < patterns.length; i++) {
            if (!destructuredFlags[i]) {
                continue;
            }
            writer.wrapLine().write("const ");
            writeContextPatterns(writer, [patterns[i]], true);
            writer.write(` = ${contextId}.${i === 0 ? "m" : "x"}.$;`);
        }
        writer.wrapLine().write(`return { ${joinedDerivedIds} };`).dedent().write("}");

        if (debugMode) {
            writer.writeLine(",");
            writer.write(`${setterArgId} => ({ ${joinedDerivedIds} } = ${setterArgId}),`);
            writer.wrapLine().write(`true)[0];`).dedent();
        } else {
            writer.writeLine(")").dedent(false);
        }
    }
    return writer;
}

// 把 setter 的赋值目标写进 setter：省略模式保留空位以维持模式与值的对应关系，
// identifier 模式仅在调试模式下参与赋值，未参与的模式在两侧同时跳过
// Write the setter assignment targets: omitted patterns keep empty slots so that patterns
// stay aligned with their values, identifier patterns are assigned only in debug mode,
// and patterns not taking part are skipped on both sides.
function writeSetterAssignment(
    writer: RuntimeCodeWriter,
    patterns: ParsedPattern[],
    assignedFlags: boolean[],
    multiPatterns: boolean,
    isRightSide: boolean,
    postfix: string,
) {
    if (multiPatterns) {
        writer.write("[");
    }

    for (let i = 0, written = false; i < patterns.length; i++) {
        const pattern = patterns[i];
        const assigned = assignedFlags[i];
        const setterArgId = generateIdentifiers.setterArg;
        if (!assigned && !ts.isOmittedExpression(pattern.node)) {
            continue;
        }
        if (written) {
            writer.write(", ");
        }
        written = true;

        if (!assigned) {
            continue;
        }
        if (isRightSide) {
            writer.write(`${setterArgId}.${i === 0 ? "m" : "x"}`);
        } else {
            writeContextPatterns(writer, [pattern], true, false);
        }
    }
    if (multiPatterns) {
        writer.write("]");
    }
    return writer.write(postfix);
}

function writeIdentifierRefreshEffect(
    writer: RuntimeCodeWriter,
    patterns: ParsedPattern[],
    contextId: string,
) {
    const assignments: string[] = [];
    const internalId = generateIdentifiers.internal;
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        if (!isArrayBindingNameIdentifier(pattern.node)) {
            continue;
        }
        for (const name of pattern.declaredIdentifiers) {
            assignments.push(`${name} = ${contextId}.${i === 0 ? "m" : "x"}.$`);
        }
    }
    if (!assignments.length) {
        return writer;
    }
    writer.wrapLine().write(`${internalId}.renderEffect(() => {`).indent(false);

    for (const assignment of assignments) {
        writer.wrapLine().write(`${assignment};`);
    }
    return writer.dedent().write("})");
}

export function writeContextPatterns(
    writer: RuntimeCodeWriter,
    patterns: ParsedPattern[],
    omitNull = false,
    destructuring = false,
) {
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const shouldWrite = !destructuring || !isArrayBindingNameIdentifier(pattern.node);
        if (i && shouldWrite) {
            writer.write(", ");
        }
        if (pattern.node) {
            if (shouldWrite) {
                writer.writeEditedScript(
                    new CodeEditor(
                        inputDescriptor.source.slice(...pattern.sourceRange),
                        pattern.sourceRange[0],
                    ),
                );
            }
        } else if (!omitNull) {
            writer.write(generateIdentifiers.getterArg);
        }
    }
    return writer;
}
