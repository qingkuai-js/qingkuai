import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ASTLocation } from "#type-declarations/compiler"

import { inputDescriptor, messages } from "../state"

export const commonMessage = (<T extends Record<string, [number, ArbitraryFunc]>>(obj: T): T => {
    return obj
})({
    ExportRelatedNotBeSupported: [
        1019,
        () => {
            return "Export statements are not supported."
        }
    ],
    UsedForbiddenIdentifierFormat: [
        1017,
        (name: string) => {
            return `The identifier "${name}" has a forbidden format.`
        }
    ],
    TopLevelAwaitNotBeSupported: [
        1018,
        () => {
            return "Top-level await expressions are not supported."
        }
    ],
    RedeclareDerivedReactiveValue: [
        1022,
        (name: string) => {
            return `The derived reactive value "${name}" cannot be redeclared.`
        }
    ],
    ShadowCompilerIntrinsicAtTopLevel: [
        1020,
        (name: string) => {
            return `Compiler intrinsic identifier "${name}" cannot be shadowed at the top level.`
        }
    ],
    InvalidUsageForIntrinsicMethods: [
        1021,
        (name: string) => {
            switch (name) {
                case "watch":
                case "preWatch":
                case "postWatch":
                case "syncWatch": {
                    return `The compiler intrinsic "${name}" can only be used as a function call.`
                }
                case "defaultRefs":
                case "defaultProps": {
                    return `The compiler intrinsic "${name}" must be called as a standalone expression at the top level.`
                }
            }
            return `The compiler intrinsic "${name}" must be called at the top-level to mark the variable initializer.`
        }
    ],
    AmbiguousReactiveMarking: [
        1023,
        (name: string) => {
            return `Using both the shorthand derived value declaration (with the $ prefix) and a different reactive-marking intrinsic (${name}) method is ambiguous.`
        }
    ]
})

// prettier-ignore
export const AmbiguousReactiveMarking = withLocation(
    ...commonMessage.AmbiguousReactiveMarking
)

export const TopLevelAwaitNotBeSupported = withLocation(
    ...commonMessage.TopLevelAwaitNotBeSupported
)

export const ExportRelatedNotBeSupported = withLocation(
    ...commonMessage.ExportRelatedNotBeSupported
)

export const UsedForbiddenIdentifierFormat = withLocation(
    ...commonMessage.UsedForbiddenIdentifierFormat
)

export const RedeclareDerivedReactiveValue = withLocation(
    ...commonMessage.RedeclareDerivedReactiveValue
)

export const InvalidUsageForIntrinsicMethods = withLocation(
    ...commonMessage.InvalidUsageForIntrinsicMethods
)

export const ShadowCompilerIntrinsicAtTopLevel = withLocation(
    ...commonMessage.ShadowCompilerIntrinsicAtTopLevel
)

export const InvalidAttributeFormat = withLocation(1016, () => {
    return "Invalid format for attributes."
})

export const EmptyInterpolationBlock = withLocation(1001, () => {
    return "Empty interpolation expression block is not allowed."
})

export const UnclosedInterpolationBlock = withLocation(1003, () => {
    return "Unclosed interpolation expression block."
})

export const UnclosedNormalAttributeValue = withLocation(1008, () => {
    return "Unclosed normal attribute value."
})

export const NoEndTagMatched = withLocation(1012, (tag: string) => {
    return `The <${tag}> tag does not have a matched end tag: </${tag}>.`
})

export const EmbeddedScriptBlockOutOfLimit = withLocation(1011, () => {
    return `The embedded script block is out of limit: only one is allowed.`
})

export const TagCanNotBeSelfClosing = withLocation(1013, (tag: string) => {
    return `The <${tag}> tag can not be used as self-closing tag.`
})

export const InvalidTemplateStructure = withLocation(1015, (msg: string) => {
    return `Invalid template structure: ${msg}.`
})

export const TemplateStartsWithEndTag = withLocation(1004, (tag: string) => {
    return `Starts with an end tag: </${tag}>.`
})

export const InvalidQuoteForNormalAttribute = withLocation(1006, () => {
    return "The normal attribute value must be quoted with single or double quote."
})

export const InvalidQuoteForInterpolatedAttribute = withLocation(1007, () => {
    return "The interpolation attribute value must be wrapped with curly bracket."
})

export const NoNameForInterpolatedAttribute = withLocation(1005, (char: string) => {
    return `The ${getSpecialAttrDescription(char)} must be specified a name.`
})

export const TagIsNotClosing = withLocation(1009, (tag: string, isEndTag = false) => {
    return `The ${
        tag === "#comment"
            ? "comment tag"
            : `${isEndTag ? "end" : "start"} tag <${isEndTag ? "/" : ""}${tag}>`
    } is not closed.`
})

export const UnexpectedToken = withLocation(1002, (str: string, expected?: string) => {
    return `Unexpected token: ${str}${expected ? `, expected: ${expected}.` : ""}`
})

export const EmbeddedLangNotInTopLevel = withLocation(1010, (tag: string) => {
    return `The embedded language block <${tag}> can only be used in the top level of the template.`
})

export const UsedDisallowedTag = withLocation(1014, (tag: string) => {
    return `The <${tag}> tag can not be used in components file, as it can not be embedded inside <body>, however you can define it in the entry HTML file.`
})

export class CompileError extends Error {
    public description = "The QingKuai compiler encountered a fatal error during execution"

    constructor(public loc: ASTLocation, public code: number, msg: string) {
        super(msg)
    }
}

// 为原始方法添加一个位置信息参数，且进行包装：非检查模式下直接抛出错误，检查模式下存放错误对象
// Add a location parameter(ASTLocation) to the original error-reporting method and wrap it:
// in non-check mode, throw the error directly; in check mode, store the error object in `messages`
function withLocation<T extends ArbitraryFunc>(code: number, fn: T) {
    function error(...[loc, ...params]: [loc: ASTLocation, ...Parameters<T>]) {
        const err = new CompileError(loc, code, fn(...params))

        if (!inputDescriptor.options.checkMode) {
            throw err
        }
        messages.push({
            value: err,
            type: "error"
        })
    }
    return error
}

// 获取特殊属性的描述（指令、事件、动态或引用属性）
// Retrieve the description of a special attribute (such as directives, events, or dynamic/reference attributes)
function getSpecialAttrDescription(tc: string) {
    switch (tc) {
        case "#": {
            return "directive"
        }
        case "@": {
            return "event listener"
        }
        case "!": {
            return "dynamic attribute"
        }
        case "&": {
            return "reference attribute"
        }
        default: {
            return "normal attribute"
        }
    }
}
