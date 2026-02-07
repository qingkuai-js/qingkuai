import type { TemplateNode } from "#type-declarations/compiler"

import {
    DuplicateAttributes,
    DisallowedAttributeKind,
    SlotNameAttributeMustBeStatic
} from "../message/error"
import { analyzeEvent } from "./event"
import { analyzeResult } from "../state"
import { analyzeDirective } from "./directive"
import { analyzeReferenceAttribute } from "./reference"
import { interpolatedAttrStartCharRE } from "../regular"
import { RedundantBooleanAttributeValue } from "../message/warn"
import { getAttributeBaseName, increaseCommonStringCount } from "../../util/compiler/sundry"
import { ATTRIBUTE_PRIORITY_MAP, SPREAD_TAG } from "../constants"
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { analyzeInterpolation, analyzeShorthandAttribute } from "./interpolation"

export function analyzeAttributes(node: TemplateNode) {
    const { attributesMap, sortedDirectives } = analyzeResult.template.nodeInfos.get(node)!

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
        const rawValue = attribute.value.raw
        const isComponent = !!node.componentTag
        const baseName = getAttributeBaseName(rawName)

        if (node.isEmbedded) {
            // 嵌入语言标签上只允许静态属性
            // Only static attributes are allowed on embedded language tags.
            if (interpolatedAttrStartCharRE.test(rawName[0])) {
                DisallowedAttributeKind(attribute.loc, node.tag, rawName)
                continue
            }

            if (/[jt]s$/.test(node.tag) && rawName === "shallow" && attribute.equalSign) {
                RedundantBooleanAttributeValue(attribute.loc, node.tag, rawName)
            }
        }

        // SPREAD_TAG 标签仅允许指令作为属性
        // The SPREAD_TAG element only allows directives as attributes.
        if (!isDirective && SPREAD_TAG === node.tag) {
            mappedKey = rawName
            DisallowedAttributeKind(nameLoc, SPREAD_TAG, rawName)
        }

        if (!isDirective && "slot" === node.tag) {
            if (isEvent || isReference) {
                mappedKey = rawName
                DisallowedAttributeKind(nameLoc, node.tag, rawName)
            }

            // slot 标签且只允许使用静态 name 属性
            // Slot tags only allow a static `name` attribute.
            if (baseName === "name" && (isDynamic || isReference)) {
                mappedKey = rawName
                SlotNameAttributeMustBeStatic(nameLoc)
            }
        }

        // 动态属性同名简写语法，更新顶级作用域标识符的响应性状态
        // For dynamic attributes with same-name shorthand syntax,
        // update the reactive status of the corresponding top-level scope identifier.
        if (!attribute.equalSign && isDynamic) {
            analyzeShorthandAttribute(rawName, nameLoc)
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
            mappedKey ??= baseName
        }

        // 重复的属性
        // Duplicate attribute.
        if (attributesMap[mappedKey]) {
            const existing = attributesMap[mappedKey]
            DuplicateAttributes(nameLoc, existing.name.raw, rawName, isComponent)
            DuplicateAttributes(existing.name.loc, existing.name.raw, rawName, isComponent)
        }

        switch (((attributesMap[mappedKey] = attribute), rawName[0])) {
            case "@": {
                analyzeEvent(node, attribute)
                break
            }
            case "#": {
                sortedDirectives.push(attribute)
                analyzeDirective(node, attribute)
                break
            }
            case "&": {
                analyzeReferenceAttribute(node, attribute)
                break
            }
            case "!": {
                if (shouldAnalyzeAttributeValue(attribute)) {
                    analyzeInterpolation(node, attribute, rawValue, attribute.value.loc.start.index)
                }
                // fallthrough
            }
            default: {
                !attributesMap[mappedKey] && increaseCommonStringCount(mappedKey)
            }
        }
    }
}
