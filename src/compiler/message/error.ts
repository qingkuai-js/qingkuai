import type { ASTLocation } from "../types"
import type { GeneralFunc } from "../../util/types"

import { lastElem } from "../../util/shared/sundry"
import { bannedIdentifierFormatRE } from "../regular"

export const UnexpectedToken = withLocation(1001, (char: string) => {
    return `Unexpected token: ${char}`
})

export const TagIsNotClosing = withLocation(1002, (tag: string) => {
    return `The tag(${tag}) is not closing.`
})

export const UnclosedNormalAttributeValue = withLocation(1003, () => {
    return "Unclosed attribute value."
})

export const UnclosedInterpolationExpression = withLocation(1004, () => {
    return "Unclosed interpolation expression."
})

export const InvalidIdentifierName = withLocation(1005, (name: string) => {
    return `The identifier name(${name}) is invalid.`
})

export const TemplateStartsWithEndTag = withLocation(1006, (text: string) => {
    return `Starts with an end tag: ${text}`
})

export const EmptyInterpolationAttrName = withLocation(1007, (char: string) => {
    const itemDescription = getSpecialAttrDescription(char)
    return `The ${itemDescription!} must be specified a name.`
})

export const SlotNameAttributeIsEmpty = withLocation(1008, () => {
    return "The name attribute for slot tag can not be empty."
})

export const EmptyInterpolationExpression = withLocation(1009, () => {
    return "Empty interpolation expression block is not allowed."
})

export const EmbeddedScriptBlockOutOfLimit = withLocation(1010, () => {
    return `The embedded script block is out of limit(only one is allowed)`
})

export const TagCantBeSelfClosing = withLocation(1011, (tag: string) => {
    return `The tag(${tag}) can not be used as self closing tag.`
})

export const UseKeyDirectiveWithoutForDirective = withLocation(1012, () => {
    return "Key directive could not be used without for directive."
})

export const InvalidSlotAttribute = withLocation(1013, (typeChar: string) => {
    const typeStr = typeChar === "!" ? "Dynamic" : "Reference"
    return `${typeStr} slot attribute(${typeChar}slot) is not allowed.`
})

export const DuplicateSlotAttributeValue = withLocation(1014, (name: string) => {
    return `Multiple tags have the same slot attribute value(${name})`
})

export const CouldNotPassRefValue = withLocation(1015, (key: string, tag: string) => {
    return `Can not pass any reference value(${key}) for normal tag(${tag})`
})

export const NoValueForRequiredValueAttribute = withLocation(1016, (key: string) => {
    const itemDescription = getSpecialAttrDescription(key[0])
    return `The ${itemDescription}(${key}) must have a value.`
})

export const NoBracketForAttributeInterpolation = withLocation(1017, () => {
    return "The interpolation attribute value must be wrapped with curly bracket."
})

export const AttributeValueIsNotQuoted = withLocation(1018, () => {
    return "The normal attribute value must be quoted with single or double quote."
})

export const DirectivesCantCoexist = withLocation(1019, (directives: string[]) => {
    return `Directives(${directives.join(", ")}) can not be used simultaneously.`
})

export const InvalidSlotNameAttribute = withLocation(1020, (typeChar: string) => {
    const typeStr = typeChar === "!" ? "Dynamic" : "Reference"
    return `${typeStr} name attribute(${typeChar}name) for slot tag is not allowed.`
})

export const RegisterExsitingIdentifierName = withLocation(1021, (name: string) => {
    return `The identifier name(${name}) to register already exists in the top scope.`
})

export const SlotAttributeIsEmpty = withLocation(1022, () => {
    return "The Slot attribute can not be empty for the direct child of a component."
})

export const NoForDirectiveCtxNameSpeciffied = withLocation(1023, (secionName: string) => {
    return `Must specify a name for the ${secionName} secion context of the for directive.`
})

export const DuplicateAttributeKey = withLocation(1024, (tag: string, a: string, b: string) => {
    let description = ""
    if (a[0] === "#") {
        return `The directive(${a}) of ${tag} tag is duplicate.`
    }
    if (a === b) {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
    } else {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
        description += ` and ${getSpecialAttrDescription(b[0])}(${b})`
    }
    return `The name for ${description} of ${tag} tag is duplicate.`
})

export const MissingStartDirective = withLocation(1025, (directive: string, sd: string) => {
    return `The ${directive} directive must be used after ${sd} directive.`
})

export const CompilerFuncNotInTopScope = withLocation(1026, () => {
    return "Reactivity related ompiler helper functions(rea, stc, der) must be used in the top scope."
})

export const RefuseReferenceAttribute = withLocation(1027, (tag: string, attr: string) => {
    return `The <${tag}> tag with dynamic ${attr} attribute(!${attr}) can not accept any reference attribute.`
})

export const CompilerFuncWithoutVariableDeclaration = withLocation(1028, () => {
    return "Reactivity related compiler helper functions(rea, stc, der) must be used for a variable declaration statement."
})

export const IdentifierFormatIsNotAllowed = withLocation(1029, (identifier: string) => {
    return `The identifier(${identifier}) format is not allowed, banned identifier format: /${bannedIdentifierFormatRE.source}/`
})

export const DestructureReactFuncWithNoArg = withLocation(1030, (funcName: string) => {
    return `Compiler helper function(${funcName}) will return undefined when no argument is passed, so it cannot be destructured.`
})

export const BadValueForRefAttr = withLocation(1031, (exp: string) => {
    return `Only assignable expression(lvalue) can be passed to reference attribute, the given expression(${exp}) is not allowed.`
})

export const InvalidRefAttr = withLocation(1032, (tag: string, attr: string[], given: string) => {
    const allowedAttrJoined = attr.join(" or ")
    const allowedAttrDescription = attr.map(item => "&" + item).join(", ")
    return `Normal tag(${tag}) can only accept ${allowedAttrJoined} as reference attribute(${allowedAttrDescription}), and the given item(&${given}) is not allowed.`
})

// 判断错误类型是会否是QingKuai编译错误
export function isQimgKuaiCompileError(err: Error) {
    return err instanceof CompileError
}

class CompileError extends Error {
    declare Description: string

    constructor(public loc: ASTLocation, public code: number, msg: string) {
        super(msg)
        this.Description = "The QingKuai compiler encountered a fatal error during execution"
    }
}

function withLocation<T extends GeneralFunc>(code: number, fn: T) {
    return (...args: [...Parameters<T>, loc: ASTLocation]) => {
        throw new CompileError(lastElem(args), code, fn(...args.slice(0, -1)))
    }
}

// 获取特殊属性的描述（指令、事件、动态即引用属性）
function getSpecialAttrDescription(tc: string) {
    switch (tc) {
        case "#":
            return "directive"
        case "@":
            return "event listener"
        case "!":
            return "dynamic attribute"
        case "&":
            return "reference attribute"
    }
    return "normal attribute"
}
