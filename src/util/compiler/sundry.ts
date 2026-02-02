import type { TemplateNode } from "#type-declarations/compiler"

import { SPREAD_TAG } from "../../compiler/constants"

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
