import type { TemplateNode } from "#type-declarations/compiler"

import {
    DuplicateAttributes,
    DisallowedAttributeKind,
    SlotNameAttributeMustBeStatic
} from "../message/error"
import { analyzeDirective } from "./directive"
import { kebab2Camel } from "../../util/compiler/string"
import { interpolatedAttrStartCharRE } from "../regular"
import { analyzeResult, inputDescriptor } from "../state"
import { RedundantBooleanAttributeValue } from "../message/warn"
import { getAttributeBaseName } from "../../util/compiler/sundry"
import { ATTRIBUTE_PRIORITY_MAP, SPREAD_TAG } from "../constants"

export function analyzeAttributes(node: TemplateNode) {
    const { attributesMap, directives } = analyzeResult.template.nodeInfos.get(node)!

    // 根据 ATTRIBUTE_PRIORITY_MAP 对属性进行排序
    // Sort attributes according to `ATTRIBUTE_PRIORITY_MAP`.
    node.attributes.sort((a, b) => {
        const av = ATTRIBUTE_PRIORITY_MAP[a.name.raw] ?? 0
        const bv = ATTRIBUTE_PRIORITY_MAP[b.name.raw] ?? 0
        return bv - av
    })

    for (const attribute of node.attributes) {
        let mappedKey: string
        const nameLoc = attribute.name.loc
        const rawName = attribute.name.raw
        const isEvent = "@" === rawName[0]
        const isDynamic = "!" === rawName[0]
        const isDirective = "#" === rawName[0]
        const isReference = "&" === rawName[0]
        const isComponent = !!node.componentTag

        if (node.isEmbedded) {
            // 嵌入语言标签上只允许静态属性
            // Only static attributes are allowed on embedded language tags.
            if (interpolatedAttrStartCharRE.test(rawName[0])) {
                DisallowedAttributeKind(attribute.loc, node.tag, rawName)
            }

            if (/[jt]s$/.test(node.tag) && rawName === "shallow" && attribute.equalSign) {
                RedundantBooleanAttributeValue(attribute.loc, node.tag, rawName)
            }
            continue
        }

        // SPREAD_TAG 标签仅允许指令作为属性
        // The SPREAD_TAG element only allows directives as attributes.
        if (!isDirective && SPREAD_TAG === node.tag) {
            mappedKey = rawName
            DisallowedAttributeKind(nameLoc, SPREAD_TAG, rawName)
        }

        // slot 标签且只允许使用静态 name 属性
        // Slot tags only allow a static `name` attribute.
        if (!isDirective && "slot" === node.tag) {
            if (((mappedKey = rawName), isEvent || isReference)) {
                DisallowedAttributeKind(nameLoc, node.tag, rawName)
            }
            if ((isDynamic || isReference) && "name" === getAttributeBaseName(attribute)) {
                SlotNameAttributeMustBeStatic(nameLoc)
            }
        }

        // mappedKey 用于检查属性是否被重复传递
        // 对于组件标签：静态属性，动态属性及事件的基础名称不能重复
        // 对于非组件标签：静态属性，动态属性及引用属性的基础名称不能重复，但 class 和 !class 可同时存在
        //
        // `mappedKey` is used to check whether a attribute has been passed multiple times.
        // For component tags: the base names of static props, dynamic props, and events must not be duplicated.
        // For non-component tags: the base names of static props, dynamic props, and reference props must not be duplicated,
        // but `class` and `!class` may coexist.
        if (
            isDirective ||
            (isComponent && isReference) ||
            (!isComponent && (isEvent || rawName === "!class"))
        ) {
            mappedKey = rawName
        } else {
            mappedKey ??= getAttributeBaseName(attribute)
        }

        // 重复的属性
        // Duplicate attribute.
        if (attributesMap[mappedKey]) {
            const existing = attributesMap[mappedKey]
            DuplicateAttributes(nameLoc, existing.name.raw, rawName, isComponent)
            DuplicateAttributes(existing.name.loc, existing.name.raw, rawName, isComponent)
        }

        // 同名简写语法，更新顶级作用域标识符的响应性状态
        // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
        if (
            !isDirective &&
            !node.isEmbedded &&
            !attribute.equalSign &&
            (isDynamic || isEvent || isReference)
        ) {
            updateTopLevelIdentifierStatus(kebab2Camel(getAttributeBaseName(attribute)))
        }

        switch (((attributesMap[mappedKey] = attribute), rawName[0])) {
            case "#": {
                directives.push(attribute)
                analyzeDirective(node, attribute)
                break
            }
            case "@": {
                break
            }
            case "&": {
                break
            }
        }
    }
}

function updateTopLevelIdentifierStatus(id: string) {
    const info = analyzeResult.script.topLevelIdentifiers[id]
    if (info?.status === "pending") {
        info.status = inputDescriptor.options.reactivityMode
    }
}
