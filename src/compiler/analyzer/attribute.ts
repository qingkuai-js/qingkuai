import type { AnalyzedTemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    DuplicateAttributes,
    ConflictDirectives,
    MissingDirectiveValue,
    DisallowedAttributeKind
} from "../message/error"
import {
    ATTRIBUTE_PRIORITY_MAP,
    CONFLICT_DIRECTIVES_MAP,
    REQUIRED_VALUE_DIRECTIVES
} from "../constants"
import { analyzeResult } from "../state"
import { analyzeDirective } from "./directive"
import { kebab2Camel } from "../../util/compiler/string"
import { interpolatedAttrStartCharRE } from "../regular"
import { RedundantAttributeValue } from "../message/warn"
import { getLocByIndex } from "../../util/compiler/position"
import { attributeHasNonEmptyValue } from "../../util/compiler/assert"
import { getAttributeBaseName, updateTopLevelIdentifierStatus } from "../../util/compiler/sundry"

export function analyzeAttributes(node: TemplateNode) {
    const isScript = node.isEmbedded && /^lang-[jt]s$/.test(node.tag)
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
        const valueLoc = attribute.value.loc
        const isComponent = !!node.componentTag
        const isDirective = rawName.startsWith("#")
        const analyzedAttribute: AnalyzedTemplateAttribute = {
            ...attribute,
            hasValue: "unknown"
        }

        if (isScript) {
            if (interpolatedAttrStartCharRE.test(rawName[0])) {
                DisallowedAttributeKind(attribute.loc, node.tag, rawName)
            }
            if (rawName === "shallow" && attribute.equalSign) {
                const sourceLoc = getLocByIndex(nameLoc.start.index, valueLoc.end.index)
                RedundantAttributeValue(sourceLoc, node.tag, rawName)
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
            (isComponent && rawName.startsWith("&")) ||
            (!isComponent && (rawName.startsWith("@") || rawName === "!class"))
        ) {
            mappedKey = rawName
        } else {
            mappedKey = getAttributeBaseName(attribute)
        }

        if (!isDirective) {
            const existing = attributesMap[mappedKey]
            if (existing) {
                DuplicateAttributes(nameLoc, existing.name.raw, rawName)
                DuplicateAttributes(existing.loc, existing.name.raw, rawName)
            }

            // 同名简写语法，更新顶级作用域标识符的响应性状态
            // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
            if (/[!@&]/.test(rawName[0]) && !attribute.equalSign) {
                updateTopLevelIdentifierStatus(kebab2Camel(getAttributeBaseName(attribute)))
            }
        } else {
            const existingKey = CONFLICT_DIRECTIVES_MAP[rawName]?.find(item => {
                return !!attributesMap[item]
            })
            if (REQUIRED_VALUE_DIRECTIVES.has(rawName)) {
                if (attributeHasNonEmptyValue(attribute)) {
                    analyzedAttribute.hasValue = "yes"
                } else {
                    MissingDirectiveValue(nameLoc, rawName)
                }
            }
            if (existingKey) {
                ConflictDirectives(nameLoc, existingKey, rawName)
                ConflictDirectives(attributesMap[existingKey].name.loc, existingKey, rawName)
            }
            directives.push(rawName)
        }
        attributesMap[mappedKey] = analyzedAttribute
        isDirective && analyzeDirective(node, attribute)
    }
}
