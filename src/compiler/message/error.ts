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
 * (at last-error-code below), each time you add a new error method and use a
 * new error code, you need update the error code you used this time to the header
 * comment of this file. (Convention: the new error code is: last-error-code + 1)
 *
 * last-error-code: 1045
 *
 * 错误代码解释：以数字1开头的代码表示这是一个编译器致命错误
 * Error Code Explanation: code begining with the number 1 indicates that this is a compiler fatal error
 */

import type { ASTLocation } from "../types"
import type { GeneralFunc, NumNum } from "../../util/types"

import { commonMessage } from "./common"
import { tagIsComponentRE } from "../regular"
import { lastElem } from "../../util/shared/sundry"
import { isNumber } from "../../util/shared/assert"
import { inputDescriptor, messages } from "../state"
import { getLocByIndex } from "../../util/compiler/locations"
import { SPREAD_TAG } from "../constants"

// prettier-ignore
export const BadExportRelatedStatement = withLocation(
    ...commonMessage.BadExportRelatedStatement
)

export const WatchCompilerFuncMissingArg = withLocation(
    ...commonMessage.WatchCompilerFuncMissingArg
)

export const TopLevelAwaitNotBeSupported = withLocation(
    ...commonMessage.TopLevelAwaitNotBeSupported
)

export const BadValueToReferenceAttribute = withLocation(
    ...commonMessage.BadValueToReferenceAttribute
)

export const IdentifierFormatIsNotAllowed = withLocation(
    ...commonMessage.IdentifierFormatIsNotAllowed
)

export const DestructureReactFuncWithNoArg = withLocation(
    ...commonMessage.DestructureReactFuncWithNoArg
)

export const ReactCompilerFuncNotInTopScope = withLocation(
    ...commonMessage.ReactCompilerFuncNotInTopScope
)

export const RegisterExsitingIdentifierName = withLocation(
    ...commonMessage.RegisterExsitingIdentifierName
)

export const ConvenientDerivedWithOtherReactFunc = withLocation(
    ...commonMessage.ConvenientDerivedWithOtherReactFunc
)

export const ReactCompilerFuncWithoutVariableDeclaration = withLocation(
    ...commonMessage.ReactCompilerFuncWithoutVariableDeclaration
)

export const UnexpectedToken = withLocation(1002, (char: string) => {
    return `Unexpected token: ${char}`
})

export const BadValueToForDirective = withLocation(1036, () => {
    return `Bad value to the #for directive.`
})

export const UnclosedNormalAttributeValue = withLocation(1005, () => {
    return "Unclosed attribute value."
})

export const DynamicNameAttrForSlot = withLocation(1019, () => {
    return `Dynamic name attribute(!name) for slot tag is not allowed.`
})

export const UnclosedInterpolationExpression = withLocation(1003, () => {
    return "Unclosed interpolation expression."
})

export const InvalidSlotAttr = withLocation(1031, (typeChar: string) => {
    const description = typeChar === "!" ? "Dynamic" : "Reference"
    return `${description} slot attribute(${typeChar}slot) is not allowed.`
})

export const InvalidIdentifierName = withLocation(1004, (name: string) => {
    return `The identifier name(${name}) is invalid.`
})

export const NoEndTagMatched = withLocation(1034, (tag: string) => {
    return `The <${tag}> tag does not have a matched end tag(</${tag}>)`
})

export const EmptyInterpolationExpression = withLocation(1001, () => {
    return "Empty interpolation expression block is not allowed."
})

export const EmbeddedScriptBlockOutOfLimit = withLocation(1009, () => {
    return `The embedded script block is out of limit(only one is allowed)`
})

export const TagCanNotBeSelfClosing = withLocation(1010, (tag: string) => {
    return `The tag(${tag}) can not be used as self closing tag.`
})

export const HtmlDirectiveWithChildElement = withLocation(1042, () => {
    return "The tag with #html directive must accept one text node as child."
})

export const UseKeyDirectiveWithoutForDirective = withLocation(1011, () => {
    return "Key directive could not be used without #for directive."
})

export const TemplateStartsWithEndTag = withLocation(1007, (text: string) => {
    return `Starts with an end tag: ${text}`
})

export const MustPassValueForDirective = withLocation(1015, (name: string) => {
    return `The directive(${name}) must have a value.`
})

export const EmptyInterpolationAttrName = withLocation(1008, (char: string) => {
    const itemDescription = getSpecialAttrDescription(char)
    return `The ${itemDescription!} must be specified a name.`
})

export const NoBracketForAttributeInterpolation = withLocation(1016, () => {
    return "The interpolation attribute value must be wrapped with curly bracket."
})

export const EmbeddedLangNotInTopScope = withLocation(1035, (tag: string) => {
    return `The embedded language block(${tag}) can only be used in the top scope.`
})

export const AttributeValueIsNotQuoted = withLocation(1017, () => {
    return "The normal attribute value must be quoted with single or double quote."
})

export const DirectivesCantCoexist = withLocation(1018, (directives: string[]) => {
    return `Directives(${directives.join(", ")}) can not be used simultaneously.`
})

export const MissingStartDirective = withLocation(1022, (d: string, pd: string) => {
    return `The ${d} directive must be used after ${pd} directive.`
})

export const TagIsNotClosing = withLocation(1006, (tag: string, isEndTag: boolean) => {
    return `The ${isEndTag ? "end" : "start"} tag(${tag}) is not closing.`
})

export const BasSlotDirectiveCarrier = withLocation(1012, () => {
    return `Slot directive(#slot) can only be used on the direct child element(first-level)`
})

export const CanNotAcceptRefAttribute = withLocation(1014, (key: string, tag: string) => {
    return `The normal tag(${tag}) can only accept &dom reference attribute, but got &${key}.`
})

export const DuplicateAttributeKey = withLocation(1021, (tag: string, a: string, b: string) => {
    let description = ""
    const isComponent = tagIsComponentRE.test(tag)
    if (a[0] === "#") {
        return `The directive(${a}) of <${tag}> tag is duplicate.`
    }
    if (a === b) {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
    } else {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
        description += ` and ${getSpecialAttrDescription(b[0])}(${b})`
    }
    tag = `${isComponent ? "component" : "normal tag"}(${tag})`
    return `The name for ${description} of ${tag} is duplicate.`
})

export const DuplicateNameAttrForSlot = withLocation(1032, (value: string) => {
    return `Multiple <slot> tags use the same name attribute value(${value}) is not allowed.`
})

export const DuplicateSlotAttr = withLocation(1013, (name: string, component: string) => {
    return `Multiple elements used as slot in component(${component}) have the same name(${name})`
})

export const BadEventListenerForSlotTag = withLocation(1039, (attr: string) => {
    return `For clearer semanticals, the <slot> tag can not accept any event listener, but got ${attr}.`
})

export const BadTargetForHtmlDirective = withLocation(1043, () => {
    return `Bad target for #html directive: it can not be used with in component, slot and self-closing tag.`
})

export const RefuseReferenceAttribute = withLocation(1024, (tag: string, attr: string) => {
    return `The <${tag}> tag with dynamic ${attr} attribute(!${attr}) can only accept &dom as reference attribute.`
})

export const ContextIdentifierUsedAsReferenceTarget = withLocation(1033, (name: string) => {
    return `The context identifier(${name}) can not be used as a target for reference passing, as it is a constant.`
})

export const UnkonwDirective = withLocation(1026, (name: string) => {
    return `An attribute name begining with # is considered a directive, but the given item(${name}) is an unknow directive.`
})

export const BadTargetForReferenceDom = withLocation(1044, () => {
    return `The &dom reference attribute can not be used on slot and ${SPREAD_TAG} tag, as they have no corresponding DOM Node.`
})

export const BadValueToContextGenDirective = withLocation(1041, (directive: string) => {
    return `Bad value for ${directive} directive, it expectes the following three node types: Identifier, ArrayExpression or ObjectExpression.`
})

export const InvalidRefAttr = withLocation(1030, (tag: string, attr: string, given: string) => {
    return `Normal tag(${tag}) can only accept specific reference attribute(${attr}), and the given item(&${given}) is not allowed.`
})

// 判断错误类型是会否是QingKuai编译错误
export function isCompileError(err: Error): err is CompileError {
    return err instanceof CompileError
}

export class CompileError extends Error {
    public description = "The QingKuai compiler encountered a fatal error during execution"

    constructor(public loc: ASTLocation, public code: number, msg: string) {
        super(msg)

        // 非检查模式下直接抛出错误，检查模式下将错误对象存放在messages中
        if (!inputDescriptor.options.check) {
            throw this
        } else {
            messages.push({
                value: this,
                type: "error"
            })
        }
    }
}

// 为返回错误描述信息的方法添加位置参数，它返回的是一个重载函数，这个重载函数会将原函数返回的错误描述抛出，
// 并为原方法添加接受一个ASTLocation或两个number（开始位置和结束位置）参数用来描述错误位置
function withLocation<T extends GeneralFunc>(code: number, fn: T) {
    function error(...args: [...Parameters<T>, loc: ASTLocation]): void
    function error(...args: [...Parameters<T>, startIndex: number, endIndex: number]): void
    function error(
        ...args: [...Parameters<T>, locOrStartIndex: ASTLocation | number, endIndex?: number]
    ) {
        let errorLoc: ASTLocation
        let errorMethodArgs: [...Parameters<T>]
        if (isNumber(lastElem(args))) {
            errorMethodArgs = args.slice(0, -2) as any
            errorLoc = getLocByIndex(...(args.slice(-2) as NumNum))
        } else {
            errorLoc = lastElem(args) as ASTLocation
            errorMethodArgs = args.slice(0, -1) as any
        }
        new CompileError(errorLoc, code, fn(...errorMethodArgs))
    }
    return error
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
