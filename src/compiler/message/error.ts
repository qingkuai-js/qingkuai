/**
 * 为了整个文件可读性，应尽量将较少代码的错误方法放在靠前的位置，但这样会导致错误代码
 * 不能与方法的顺序保持一致，所以这里在文件头记录了最后一个使用的错误代码（在下方的
 * last-error-code处）每次添加错误方法并使用新的错误代码时，需要将本次使用的错误
 * 代码更新到文件的头部注释中（约定：新错误代码为 last-error-code + 1）
 *
 * For the sake of the overall readability of this file, we should try
 * put the error method with less code in the front, however this results
 * in error codes can not conform to the order of the methods.
 * So, the last error code used is recorded in the file header comment
 * (at last-error code below), each time you add a new error method and use a
 * new error code, you need update the error code you used this time to the header
 * comment of this file. (Convention: the new error code is: last-error-code + 1)
 *
 * current-error-code: 1035
 */

import type { ASTLocation } from "../types"
import type { GeneralFunc } from "../../util/types"

import { lastElem } from "../../util/shared/sundry"
import { bannedIdentifierFormatRE } from "../regular"

export const UnexpectedToken = withLocation(1001, (char: string) => {
    return `Unexpected token: ${char}`
})

export const SlotAttrIsEmpty = withLocation(1022, () => {
    return "The slot attribute can not be empty."
})

export const TagIsNotClosing = withLocation(1002, (tag: string) => {
    return `The tag(${tag}) is not closing.`
})

export const UnclosedNormalAttributeValue = withLocation(1003, () => {
    return "Unclosed attribute value."
})

export const DynamicNameAttrForSlot = withLocation(1020, () => {
    return `Dynamic name attribute(!name) for slot tag is not allowed.`
})

export const UnclosedInterpolationExpression = withLocation(1004, () => {
    return "Unclosed interpolation expression."
})

export const InvalidSlotAttr = withLocation(1034, (typeChar: string) => {
    const description = typeChar === "!" ? "Dynamic" : "Reference"
    return `${description} slot attribute(${typeChar}slot) is not allowed.`
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

export const NameAttrForSlotIsEmpty = withLocation(1008, () => {
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

export const RegisterExsitingIdentifierName = withLocation(1021, (name: string) => {
    return `The identifier name(${name}) to register already exists in the top scope.`
})

export const BasSlotDirectiveCarrier = withLocation(1013, () => {
    return `Slot directive(#slot) can only be used on the direct child element(first-level)`
})

export const NoForDirectiveCtxNameSpeciffied = withLocation(1023, (sectionName: string) => {
    return `Must specify a name for the ${sectionName} section context of the #for directive.`
})

export const DuplicateAttributeKey = withLocation(1024, (tag: string, a: string, b: string) => {
    let description = ""
    if (a[0] === "#") {
        return `The directive(${a}) of <${tag}> tag is duplicate.`
    }
    if (a === b) {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
    } else {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
        description += ` and ${getSpecialAttrDescription(b[0])}(${b})`
    }
    return `The name for ${description} of <${tag}> tag is duplicate.`
})

export const MissingStartDirective = withLocation(1025, (d: string, pd: string) => {
    return `The ${d} directive must be used after ${pd} directive.`
})

export const DuplicateSlotAttr = withLocation(1014, (name: string, component: string) => {
    return `Multiple elements used as slot in component(${component}) have the same name(${name})`
})

export const DuplicateNameAttrForSlot = withLocation(1035, (value: string) => {
    return `Multiple <slot> tags use the same name attribute value(${value}) is not allowed.`
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

export const UnkonwDirective = withLocation(1029, (name: string) => {
    return `An attribute name begining with # is considered a directive, but the given item(${name}) is an unknow directive.`
})

export const IdentifierFormatIsNotAllowed = withLocation(1030, (identifier: string) => {
    return `The identifier(${identifier}) format is not allowed, banned identifier format: /${bannedIdentifierFormatRE.source}/`
})

export const DestructureReactFuncWithNoArg = withLocation(10301, (funcName: string) => {
    return `Compiler helper function(${funcName}) will return undefined when no argument is passed, so it cannot be destructured.`
})

export const BadValueForRefAttr = withLocation(1032, (exp: string) => {
    return `Only assignable expression(lvalue) can be passed to reference attribute, the given expression(${exp}) is not allowed.`
})

export const InvalidRefAttr = withLocation(1033, (tag: string, attr: string[], given: string) => {
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
        // console.log(new CompileError(lastElem(args), code, fn(...args.slice(0, -1))))
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
