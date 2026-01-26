import type { TemplateAttribute } from "#type-declarations/compiler"

import { analyzeResult, inputDescriptor } from "../../compiler/state"

export function getAttributeBaseName(attr: TemplateAttribute) {
    switch (attr.name.raw[0]) {
        case "!":
        case "@":
        case "#":
        case "&": {
            return attr.name.raw.slice(1)
        }
    }
    return attr.name.raw
}

export function updateTopLevelIdentifierStatus(id: string) {
    const info = analyzeResult.script.topLevelIdentifiers[id]
    if (info?.status === "pending") {
        info.status = inputDescriptor.options.reactivityMode
    }
}
