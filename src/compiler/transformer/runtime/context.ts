import type { RuntimeCodeWriter } from "../writer";
import type { ParsedPattern, TemplateAttribute } from "#type-declarations/compiler";

import { CodeEditor } from "../editor";
import { generateIdentifier, inputDescriptor } from "../../state";
import { isArrayBindingNameIdentifier } from "../../ts-ast/assert";
import { getParsedDirective } from "../../../util/compiler/template";
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry";

export function writeContextDeclaration(writer: RuntimeCodeWriter, directive: TemplateAttribute) {
    const parsedDirective = getParsedDirective(directive);
    if (!parsedDirective?.context) {
        return writer;
    }

    let hasDestructuring = false;
    const declaredIds: string[] = [];
    const context = parsedDirective.context;
    const patterns = parsedDirective.patterns;
    const multiPatterns = patterns.length > 1;
    const setterArgId = generateIdentifier.setterArg;
    const [contextId, plainRow] = [context.argId, !!context.plainRow];
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        declaredIds.push(...pattern.declaredIdentifiers);
        if (!isArrayBindingNameIdentifier(pattern.node)) {
            if (plainRow) {
                if (i === 0) {
                    context.rowUsesItem = true;
                } else {
                    context.rowUsesIndex = true;
                }
            }
            hasDestructuring = true;
        }
    }
    if (!hasDestructuring) {
        return writer;
    }

    const setterId = (context.setterId = ensureIdWithNumSuffix("_S"));
    writer.wrapLine().write(`let ${declaredIds.join(", ")};`);
    writer.wrapLine().write(`const ${setterId} = ${setterArgId} => (`);
    writer.write(multiPatterns ? "[" : "");
    writeContextPatterns(writer, patterns, true, true);
    writer.write(multiPatterns ? "]" : "").write(` = `);
    writer.write(multiPatterns ? "[" : "");

    for (let i = 0; i < patterns.length; i++) {
        if (isArrayBindingNameIdentifier(patterns[i].node)) {
            continue;
        }
        if (i) {
            writer.write(", ");
        }
        writer.write(`${setterArgId}.${i === 0 ? "m" : "x"}`);

        if (!plainRow) {
            writer.write(".$");
        }
    }
    writer.write(multiPatterns ? "])" : ")");

    // 响应式包装的上下文需在挂载期初始化局部变量：行内可能只有嵌套指令读取它们
    // The context wrapped in reactivity needs to initialize local variables during
    // the mounting phase: inline there may only be nested directives reading them
    if (!plainRow) {
        writer.wrapLine().write(`${setterId}(${contextId})`);
    }
    return writer;
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
            writer.write(generateIdentifier.getterArg);
        }
    }
    return writer;
}
