import type { TemplateNode } from "#type-declarations/compiler";

import { getTemplateNodeContext } from "../../util/compiler/template";
import { ROW_UNSAFE_REFERENCE_ATTRS, ROW_ROOT_ALLOWED_DIRECTIVES } from "../constants";

// 判断列表渲染的行子树是否可以使用普通值作为上下文渲染
// Determine whether the row subtree of a list rendering can be rendered from plain context values
export function isPlainRowEligible(node: TemplateNode) {
    return (
        isRowNodeEligible(node, true) &&
        !node.componentTag &&
        node.tag !== "slot" &&
        areRowChildrenEligible(node.children)
    );
}

function areRowChildrenEligible(nodes: TemplateNode[]) {
    for (const node of nodes) {
        if (
            !isRowNodeEligible(node, false) ||
            node.componentTag ||
            node.tag === "slot" ||
            !areRowChildrenEligible(node.children)
        ) {
            return false;
        }
    }
    return true;
}

function isRowNodeEligible(node: TemplateNode, isRowRoot: boolean) {
    const nodeContext = getTemplateNodeContext(node);
    for (const directive of nodeContext.sortedDirectives) {
        if (isRowRoot && ROW_ROOT_ALLOWED_DIRECTIVES.has(directive.name.raw)) {
            continue;
        }
        return false;
    }
    for (const attribute of nodeContext.referenceAttributes) {
        if (ROW_UNSAFE_REFERENCE_ATTRS.has(attribute.name.raw)) {
            return false;
        }
    }
    return true;
}
