import type { TemplateAttribute } from "#type-declarations/compiler"

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
