import { stringify } from "../shared/aliases"
import { analyzeResult } from "../../compiler/state"

export function getAttributeBaseName(name: string) {
    switch (name[0]) {
        case "!":
        case "@":
        case "#":
        case "&": {
            return name.slice(1)
        }
    }
    return name
}

export function getEventName(rawName: string) {
    const sepratorIndex = rawName.indexOf("|")
    if (-1 === sepratorIndex) {
        return rawName
    }
    return rawName.slice(0, sepratorIndex)
}

export function generateSetterCode(target: string) {
    const setterArgId = analyzeResult.generateIds.setterArg
    return `${setterArgId} => (${target} = ${setterArgId})`
}

export function getStringifiedLiteral(value: string) {
    return analyzeResult.commonStrings[value].id || stringify(value)
}

export function ensureIdWithPrefix(name: string, prefix = "_") {
    const { fullIdentifiers } = analyzeResult.script
    while (fullIdentifiers.has(name)) {
        name = prefix + name
    }
    return (fullIdentifiers.add(name), name)
}

export function ensureIdWithNumSuffix(name: string, start = 1) {
    const { fullIdentifiers } = analyzeResult.script
    for (let i = start, initial = name; true; i++) {
        if (i !== start && !fullIdentifiers.has(name)) {
            break
        }
        name = initial + i
    }
    return (fullIdentifiers.add(name), name)
}

export function increaseCommonStringCount(value: string) {
    ;(analyzeResult.commonStrings[value] ??= { id: "", times: 0 }).times++
}

export function shouldExtractCommonString(value: string, count: number) {
    return count <= 1 ? false : count === 2 ? value.length > 4 : value.length > 2
}

// TODO: useless
// /**
//  * 获取节点属性在 {@link TemplateNodeInfo.attributesMap} 中的键，对于重复的属性，它只会存储最后一个
//  * Get the key of a node attribute in {@link TemplateNodeInfo.attributesMap}. For duplicate attributes, only the last one is stored.
//  */
// export function getAttributeMappedKey(node: TemplateNode, name: string) {
//     if ("#" !== name[0] && (SPREAD_TAG === node.tag || "slot" === node.tag)) {
//         return name
//     }

//     // mappedKey 用于检查属性是否被重复传递
//     // 对于组件标签：静态属性，动态属性及事件的基础名称不能重复
//     // 对于非组件标签：静态属性，动态属性及引用属性的基础名称不能重复，但 class 和 !class 可同时存在
//     //
//     // `mappedKey` is used to check whether a attribute has been passed multiple times.
//     // For component tags: the base names of static props, dynamic props, and events must not be duplicated.
//     // For non-component tags: the base names of static props, dynamic props, and reference props must not be duplicated,
//     // but `class` and `!class` may coexist.
//     if (
//         "#" === name[0] ||
//         (node.componentTag && "&" === name[0]) ||
//         (!node.componentTag && ("@" === name[0] || name === "!class"))
//     ) {
//         return name
//     }

//     return getAttributeBaseName(name)
// }
