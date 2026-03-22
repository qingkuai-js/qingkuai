import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ASTLocation, CompileError } from "#type-declarations/compiler"

import { inputDescriptor, messages } from "../state"
import { PRESERVED_IDPREFIX, SPREAD_TAG } from "../constants"

export const TagIsNotClosing = withLocation(1009, (tag: string, isEndTag = false) => {
    return `The ${
        tag === "#comment"
            ? "comment tag"
            : `${isEndTag ? "end" : "start"} tag <${isEndTag ? "/" : ""}${tag}>`
    } is not closed.`
})

export const DuplicateAttributes = withLocation(
    1028,
    (a: string, b: string, isComponent: boolean) => {
        if (a === b) {
            return `Duplicate ${getSpecialAttrDescription(a)}s: "${a}".`
        }
        return `Duplicate attributes: the ${getSpecialAttrDescription(
            a
        )} "${a}" and the ${getSpecialAttrDescription(b)} "${b}" resolve to the same ${
            isComponent ? "prop" : "attribute"
        }.`
    }
)

export const TooManyBindingPatterns = withLocation(1037, (directive: string, count: number) => {
    return `The "${directive}" directive accepts at most ${
        count === 1 ? "one" : count === 2 ? "two" : count
    } binding pattern${count === 1 ? "" : "s"}.`
})

export const DisallowedAttributeKind = withLocation(1030, (tag: string, name: string) => {
    const gotDescription = `, but got ${getSpecialAttrDescription(name, true)}: "${name}".`
    switch (tag) {
        case SPREAD_TAG: {
            return `The <qk:spread> tag can only accept directives${gotDescription}`
        }
        case "slot": {
            return `The <slot> tag does not support reference attributes or event listeners${gotDescription}`
        }
        default: {
            return `The <${tag}> tag can only accept static attributes${gotDescription}`
        }
    }
})

export const InvalidUsageForIntrinsicMethods = withLocation(1021, (name: string) => {
    switch (name) {
        case "watch":
        case "preWatch":
        case "postWatch":
        case "syncWatch": {
            return `The compiler intrinsic "${name}" can only be used as a function call.`
        }
        case "defaultRefs":
        case "defaultProps": {
            return `The compiler intrinsic "${name}" must be called as a standalone expression at top-level scope.`
        }
    }
    return `The compiler intrinsic "${name}" must be called at top-level scope to mark the variable initializer.`
})

export const InvalidReferenceAttribute = withLocation(
    1047,
    (tag: string, name: string, allowedList: string[]) => {
        if (allowedList.length !== 1) {
            return `Invalid reference attribute "${name}" on <${tag}>.`
        }
        return `The <${tag}> tag only supports "${allowedList[0]}" as a reference attribute, but got: "${name}".`
    }
)

export const InvalidIntrinsicArgCount = withLocation(
    1059,
    (name: string, expected: number, got: number) => {
        return `The "${name}" intrinsic requires exactly ${expected} argument${expected === 1 ? "" : "s"}, but got ${got}.`
    }
)

export const MissingPrecedingDirective = withLocation(
    1031,
    (directive: string, expectedList: string[], extra = "") => {
        const expected = expectedList.reduce(
            (ret, cur, index) => `${ret}${index === 0 ? "" : ", "}"${cur}"`,
            ""
        )
        if (expectedList[0] !== "#if") {
            return `The "${directive}" directive requires one of the following preceding directives: ${expected}.${extra}`
        } else {
            return `The "${directive}" directive requires a preceding sibling element with one of the following directives: ${expected}.${extra}`
        }
    }
)

export const NestedSlotElement = withLocation(1055, () => {
    return `Nested <slot> elements are not allowed.`
})

export const ExpectedExpression = withLocation(1041, () => {
    return "Expected an expression."
})

export const ExpectedStringLiteral = withLocation(1042, () => {
    return "Expected a string literal."
})

export const ExpectedEventFlagName = withLocation(1044, () => {
    return "Expected an event flag name."
})

export const InvalidAttributeFormat = withLocation(1016, () => {
    return "Invalid format for attributes."
})

export const EmptyInterpolationBlock = withLocation(1001, () => {
    return "Empty interpolation expression block is not allowed."
})

export const UnclosedInterpolationBlock = withLocation(1003, () => {
    return "Unclosed interpolation expression block."
})

export const TopLevelAwaitNotBeSupported = withLocation(1018, () => {
    return "Top-level await expressions are not supported."
})

export const UnclosedStaticAttributeValue = withLocation(1008, () => {
    return "Unclosed static attribute value."
})

export const ExportStatementsAreNotSupported = withLocation(1019, () => {
    return "Export statements are not supported."
})

export const SlotNameAttributeMustBeStatic = withLocation(1039, () => {
    return `The "name" attribute on <slot> tag must be static.`
})

export const NoEndTagMatched = withLocation(1012, (tag: string) => {
    return `The <${tag}> tag does not have a matched end tag: </${tag}>.`
})

export const EmbeddedScriptBlockOutOfLimit = withLocation(1011, () => {
    return `The embedded script block is out of limit: only one is allowed.`
})

export const InvalidElementTagName = withLocation(1060, (tag: string) => {
    return `Invalid element tag name "${tag}".`
})

export const InvalidExpression = withLocation(1029, (explain?: string) => {
    return `Invalid expression.${explain ? " " + explain : ""}`
})

export const TagCanNotBeSelfClosing = withLocation(1013, (tag: string) => {
    return `The <${tag}> tag cannot be used as self-closing tag.`
})

export const UnrecognizedEventFlag = withLocation(1045, (name: string) => {
    return `Unrecognized event flag: "${name}".`
})

export const InvalidTemplateStructure = withLocation(1015, (msg: string) => {
    return `Invalid template structure: ${msg}.`
})

export const TemplateStartsWithEndTag = withLocation(1004, (tag: string) => {
    return `Starts with an end tag: </${tag}>.`
})

export const MissingDirectiveValue = withLocation(1027, (directive: string) => {
    return `Directive "${directive}" requires a value.`
})

export const ConflictingDirectives = withLocation(1026, (a: string, b: string) => {
    return `Conflicting directives: "${a}" and "${b}" cannot be used together.`
})

export const ConflictingEventFlags = withLocation(1046, (a: string, b: string) => {
    return `Conflicting event flags: "${a}" and "${b}" cannot be used together.`
})

export const InvalidKeyDirectivePlacement = withLocation(1043, () => {
    return `The "#key" directive is only allowed on a tag with the "#for" directive.`
})

export const InvalidIntrinsicMethodPlacement = withLocation(1061, (name: string) => {
    return `The compiler intrinsic method "${name}" cannot be used in template.`
})

export const InvalidValueEnclosureForStaticAttribute = withLocation(1006, () => {
    return "The value for static attribute must be quoted with single or double quote."
})

export const EmptyContextPattern = withLocation(1034, () => {
    return `The context pattern is empty and does not declare any binding identifiers.`
})

export const NoNameForInterpolatedAttribute = withLocation(1005, (char: string) => {
    return `The ${getSpecialAttrDescription(char)} must be specified a name.`
})

export const ShadowCompilerIntrinsicAtTopLevel = withLocation(1020, (name: string) => {
    return `Compiler intrinsic identifier "${name}" cannot be shadowed at top-level scope.`
})

export const InvalidAliasDestructuringDeclaration = withLocation(1025, (kind: string) => {
    return `${kind} are not allowed in destructuring pattern of alias declarations.`
})

export const HtmlDirectiveRequiresSingleTextChild = withLocation(1035, () => {
    return `A tag with the "#html" directive must have exactly one text node as its child.`
})

export const UnexpectedToken = withLocation(1002, (str: string, expected?: string) => {
    return `Unexpected token: ${str}${expected ? `, expected: ${expected}.` : ""}`
})

export const DuplicatePromiseBlockDirectives = withLocation(1056, (directive: string) => {
    return `The "${directive}" directive can only appear once in a promise block.`
})

export const InvalidContextPattern = withLocation(1032, () => {
    return `Invalid context pattern. Expected a valid JavaScript/typescript binding pattern.`
})

export const UsedForbiddenIdentifierFormat = withLocation(1017, () => {
    return `Identifiers starting with "${PRESERVED_IDPREFIX}" are reserved for internal use.`
})

export const InvalidSlotDirectivePlacement = withLocation(1036, () => {
    return `The "#slot" directive can only be used on direct child elements of a component node.`
})

export const InvalidSlotName = withLocation(1038, () => {
    return `The "#slot" directive requires a string literal slot name after "from" keyword.`
})

export const CannotAliasIdentifier = withLocation(1053, () => {
    return `The "alias" intrinsic cannot be used to create an alias for a standalone identifier.`
})

export const EmbeddedLangNotInTopLevel = withLocation(1010, (tag: string) => {
    return `The embedded language block <${tag}> can only be used in the top level of the template.`
})

export const InvalidValueEnclosureForInterpolatedAttribute = withLocation(1007, (name: string) => {
    return `The value for ${getSpecialAttrDescription(name)} must be wrapped with curly bracket.`
})

export const InvalidReferenceAttributeValue = withLocation(1048, () => {
    return `The value of a reference attribute must be either an identifier or a member expression.`
})

export const InvalidHtmlDirectivePlacement = withLocation(1058, (kind: "slot" | "component") => {
    return `The "#html" directive cannot be used on ${kind === "slot" ? "<slot> tags" : "components"}.`
})

export const ConflictingReactivityModes = withLocation(1062, (tag: string) => {
    return `Conflicting reactivity modes on <${tag}>: "reactive" and "shallow" cannot be used together.`
})

export const InvalidParameterForAliasIntrinsic = withLocation(1024, () => {
    return `The compiler intrinsic "alias" must accept exactly one mutable target(lvalue) as its argument.`
})

export const IntrinsicNotAllowedInUsingDeclaration = withLocation(1054, (intrinsic: string) => {
    return `The compiler intrinsic "${intrinsic}" cannot be used in a "using" or "await using" declaration.`
})

export const UnrecognizedDirective = withLocation(1033, (directive: string) => {
    return `An attribute name beginning with "#" is treated as a directive, but "${directive}" is not a recognized directive.`
})

export const InvalidComponentName = withLocation(1057, (name: string) => {
    return `Invalid component name: "${name}". It cannot be converted into a valid JavaScript identifier or member expression.`
})

export const DuplicateSlotName = withLocation(1050, (name: string) => {
    return `Duplicate slot name: "${name}". Consider using a different value for the "name" attribute on one of the <slot> tags.`
})

export const IdentifierCannotBeRedeclared = withLocation(1022, (status: string) => {
    return `The identifier cannot be redeclared when it is marked as ${status === "alias" ? "an alias" : "a derived reactive value"}.`
})

export const DuplicateSlotAssignment = withLocation(1051, (component: string, name: string) => {
    return `Multiple nodes are assigned to the same slot("${name}") in <${component}>. Consider using a different slot name in the "#slot" directive.`
})

export const UsedDisallowedTag = withLocation(1014, (tag: string) => {
    return `The <${tag}> tag cannot be used in components file, as it cannot be embedded inside <body>, however you can define it in the entry HTML file.`
})

export const TSModuleDeclarationsAreNotSupported = withLocation(1052, () => {
    return `Namespace declarations are not allowed in component embedded scripts because the embedded script block are wrapped inside a component function.`
})

export const AmbiguousReactiveMarking = withLocation(1023, (name: string) => {
    return `Using both the shorthand derived value declaration(with the "$" prefix) and a different reactive-marking intrinsic("${name}") method is ambiguous.`
})

export const InvalidTargetDirectivePlacement = withLocation(1040, () => {
    return `The "#target" directive cannot be used on direct component children because they are slot content, which would make the mount target ambiguous. Use it on the <slot> element instead.`
})

export const InvalidShorthandAttributeName = withLocation(1049, (name: string) => {
    return `Invalid name for shorthand ${getSpecialAttrDescription(name)}: "${name}". It cannot be converted into a valid JavaScript identifier. Please ensure that it is not a reserved word in JavaScript or TypeScript`
})

export function isCompileError(err: Error): err is CompileError {
    return err instanceof QingkuaiCompileError
}

class QingkuaiCompileError extends Error implements CompileError {
    public description = "The QingKuai compiler encountered a fatal error during execution"

    constructor(
        public loc: ASTLocation,
        public code: number,
        msg: string
    ) {
        super(msg)
    }
}

// 为原始方法添加一个位置信息参数，且进行包装：非检查模式下直接抛出错误，检查模式下存放错误对象
// Add a location parameter(ASTLocation) to the original error-reporting method and wrap it:
// in non-check mode, throw the error directly; in check mode, store the error object in `messages`
function withLocation<T extends ArbitraryFunc>(code: number, fn: T) {
    function error(...[loc, ...params]: [loc: ASTLocation, ...Parameters<T>]) {
        const err = new QingkuaiCompileError(loc, code, fn(...params))

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
function getSpecialAttrDescription(name: string, article = false) {
    const segments = (() => {
        switch (name[0]) {
            case "#": {
                return ["a", "directive"]
            }
            case "@": {
                return ["an", "event listener"]
            }
            case "!": {
                return ["a", "dynamic attribute"]
            }
            case "&": {
                return ["a", "reference attribute"]
            }
            default: {
                return ["a", "static attribute"]
            }
        }
    })()
    return article ? segments.join(" ") : segments[1]
}
