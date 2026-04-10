import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    DuplicateAttributes,
    DisallowedAttributeKind,
    ConflictingReactivityModes,
    SlotNameAttributeMustBeStatic
} from "../message/error"
import { analyzeEvent } from "./event"
import { analyzeDirective } from "./directive"
import { newCleanObj } from "../../util/shared/sundry"
import { analyzeReferenceAttribute } from "./reference"
import { interpolatedAttrStartCharRE } from "../regular"
import { RedundantBooleanAttributeValue } from "../message/warn"
import { getAttributeBaseName } from "../../util/compiler/sundry"
import { ATTRIBUTE_PRIORITY_MAP, SPREAD_TAG } from "../constants"
import { getTemplateNodeContext } from "../../util/compiler/template"
import { increaseReusedStringUsedTimes } from "../optimizer/compress"
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { analyzeInterpolation, analyzeTemplateAsExpression } from "./interpolation"

export function analyzeAttributes(node: TemplateNode) {
    const nodeContext = getTemplateNodeContext(node)
    const isEmbeddedScript = node.tag === "lang-js" || node.tag === "lang-ts"
    const duplicateCheckAttrsMap: Record<string, TemplateAttribute> = newCleanObj()

    // 根据 ATTRIBUTE_PRIORITY_MAP 对属性进行排序
    // Sort attributes according to `ATTRIBUTE_PRIORITY_MAP`.
    const sortedAttributes = node.attributes.toSorted((a, b) => {
        const av = ATTRIBUTE_PRIORITY_MAP[a.name.raw] ?? 0
        const bv = ATTRIBUTE_PRIORITY_MAP[b.name.raw] ?? 0
        return bv - av
    })

    for (const attribute of sortedAttributes) {
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

        if (!node.isEmbedded && (isDynamic || (isReference && isComponent))) {
            markAttributeNameAsReusedStrings(node, attribute)
        }

        // 嵌入语言标签上只允许静态属性
        // Only static attributes are allowed on embedded language tags.
        if (node.isEmbedded && interpolatedAttrStartCharRE.test(rawName[0])) {
            DisallowedAttributeKind(attribute.loc, node.tag, rawName)
            continue
        }

        if (
            isEmbeddedScript &&
            attribute.equalSign &&
            (rawName === "shallow" || rawName === "reactive")
        ) {
            RedundantBooleanAttributeValue(attribute.loc, node.tag, rawName)
        }

        // 嵌入脚本标签上的 reactive 和 shallow 属性不能同时存在
        // The `reactive` and `shallow` attributes cannot coexist on embedded script tags.
        if (
            !duplicateCheckAttrsMap[rawName] &&
            ((rawName === "shallow" && nodeContext.attributesMap.reactive) ||
                (rawName === "reactive" && nodeContext.attributesMap.shallow))
        ) {
            const existingKey = rawName === "shallow" ? "reactive" : "shallow"
            ConflictingReactivityModes(attribute.name.loc, node.tag)
            ConflictingReactivityModes(nodeContext.attributesMap[existingKey].name.loc, node.tag)
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

        // mappedKey 用于检查属性是否被重复传递
        // - 对于组件标签：静态属性，动态属性及事件的基础名称不能重复
        // - 对于非组件标签：静态属性，动态属性及引用属性的基础名称不能重复，但 class 和 !class 可同时存在
        //
        // `mappedKey` is used to check whether a attribute has been passed multiple times.
        // - For component tags: the base names of static props, dynamic props, and events must not be duplicated.
        // - For non-component tags: the base names of static props, dynamic props, and reference props must not be duplicated,
        //   but `class` and `!class` may coexist.
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
        if (duplicateCheckAttrsMap[mappedKey]) {
            const existing = duplicateCheckAttrsMap[mappedKey]
            DuplicateAttributes(nameLoc, existing.name.raw, rawName, isComponent)
            DuplicateAttributes(existing.name.loc, existing.name.raw, rawName, isComponent)
        }
        nodeContext.attributesMap[rawName] = duplicateCheckAttrsMap[mappedKey] = attribute

        switch (rawName[0]) {
            case "@": {
                analyzeEvent(node, attribute)
                nodeContext.eventListeners.push(attribute)
                break
            }
            case "#": {
                analyzeDirective(node, attribute)
                nodeContext.sortedDirectives.push(attribute)
                break
            }
            case "&": {
                analyzeReferenceAttribute(node, attribute)
                nodeContext.referenceAttributes.push(attribute)
                break
            }
            case "!": {
                if (!attribute.equalSign) {
                    analyzeTemplateAsExpression(node, rawName, attribute, nameLoc, "attribute")
                }
                if (shouldAnalyzeAttributeValue(attribute)) {
                    analyzeInterpolation(node, attribute, rawValue, attribute.value.loc.start.index)
                }
                nodeContext.dynamicAttributes.push(attribute)
                break
            }
            default: {
                nodeContext.staticAttributes.push(attribute)
                break
            }
        }
    }
}

function markAttributeNameAsReusedStrings(node: TemplateNode, attribute: TemplateAttribute) {
    const rawName = attribute.name.raw
    const baseName = getAttributeBaseName(rawName)
    if (node.componentTag) {
        increaseReusedStringUsedTimes(baseName, true)
    } else if (rawName !== "!class") {
        if (!baseName.startsWith("xlink:")) {
            increaseReusedStringUsedTimes(baseName)
        } else {
            increaseReusedStringUsedTimes(baseName.slice(6))
        }
    }
}
