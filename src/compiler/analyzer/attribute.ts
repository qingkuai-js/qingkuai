import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    DuplicateAttributes,
    ConflictDirectives,
    DisallowedAttributeKind,
    SlotNameAttributeMustBeStatic
} from "../message/error"
import { analyzeDirective } from "./directive"
import { kebab2Camel } from "../../util/compiler/string"
import { interpolatedAttrStartCharRE } from "../regular"
import { RedundantAttributeValue } from "../message/warn"
import { analyzeResult, inputDescriptor } from "../state"
import { getAttributeBaseName } from "../../util/compiler/sundry"
import { ATTRIBUTE_PRIORITY_MAP, CONFLICT_DIRECTIVES_MAP } from "../constants"

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
        const rawName = attribute.name.raw
        const nameLoc = attribute.name.loc
        const isComponent = !!node.componentTag

        // mappedKey 用于检查属性是否被重复传递
        // 对于组件标签：静态属性，动态属性及事件的基础名称不能重复
        // 对于非组件标签：静态属性，动态属性及引用属性的基础名称不能重复，但 class 和 !class 可同时存在
        //
        // `mappedKey` is used to check whether a attribute has been passed multiple times.
        // For component tags: the base names of static props, dynamic props, and events must not be duplicated.
        // For non-component tags: the base names of static props, dynamic props, and reference props must not be duplicated,
        // but `class` and `!class` may coexist.
        if (
            "#" === rawName[0] ||
            (isComponent && "&" !== rawName[0]) ||
            (!isComponent && ("@" !== rawName[0] || rawName === "!class"))
        ) {
            mappedKey = rawName
        } else {
            mappedKey = getAttributeBaseName(attribute)
        }

        if ("#" === rawName[0]) {
            const existingKey = CONFLICT_DIRECTIVES_MAP[rawName]?.find(item => {
                return !!attributesMap[item]
            })
            if (existingKey) {
                ConflictDirectives(nameLoc, existingKey, rawName)
                ConflictDirectives(attributesMap[existingKey].name.loc, existingKey, rawName)
            }
            directives.push(rawName)
        } else {
            const existing = attributesMap[mappedKey]
            if (existing) {
                DuplicateAttributes(nameLoc, existing.name.raw, rawName)
                DuplicateAttributes(existing.loc, existing.name.raw, rawName)
            }

            // 同名简写语法，更新顶级作用域标识符的响应性状态
            // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
            if (
                !node.isEmbedded &&
                !attribute.equalSign &&
                interpolatedAttrStartCharRE.test(rawName[0])
            ) {
                updateTopLevelIdentifierStatus(kebab2Camel(getAttributeBaseName(attribute)))
            }
        }

        switch (((attributesMap[mappedKey] = attribute), rawName[0])) {
            case "#": {
                return analyzeDirective(node, attribute)
            }
            case "@": {
                return
            }
            case "&": {
                return
            }
            default: {
                return analyzeStaticOrDynamicAttribute(node, attribute)
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

function analyzeStaticOrDynamicAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const rawName = attribute.name.raw

    // slot 标签且只允许使用静态 name 属性
    // Slot tags only allow a static `name` attribute.
    if (node.tag === "slot" && rawName[0] !== "#" && "name" === getAttributeBaseName(attribute)) {
        SlotNameAttributeMustBeStatic(attribute.loc)
    }

    if (node.isEmbedded) {
        // 嵌入语言标签上只允许静态属性
        // Only static attributes are allowed on embedded language tags.
        if (interpolatedAttrStartCharRE.test(rawName[0])) {
            DisallowedAttributeKind(attribute.loc, node.tag, rawName)
        }

        if (/[jt]s$/.test(node.tag) && rawName === "shallow" && attribute.equalSign) {
            RedundantAttributeValue(attribute.loc, node.tag, rawName)
        }
    }
}
