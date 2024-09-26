import { isUndefined } from "../../util/shared"
import { bannedIdentifierFormat } from "../regular"

export function TagIsNotClosing(tag: string) {
    error(`The tag(${tag}) is not closing.`)
}

export function UnclosedInterpolationExpression() {
    error("Unclosed interpolation expression.")
}

export function InvalidIdentifierName(name: string) {
    error(`The identifier name(${name}) is invalid.`)
}

export function TemplateStartsWithEndTag(text: string) {
    error(`Starts with an end tag: ${text}`)
}

export function EmptyInterpolationAttrName(char: string) {
    const itemDescription = getSpecialAttrDescription(char)
    error(`The ${itemDescription!} must be specified a name.`)
}

export function SlotNameAttributeIsEmpty() {
    error("The name attribute for slot tag can not be empty.")
}

export function TagCantBeSelfClosing(tag: string) {
    error(`The tag(${tag}) can not be used as self closing tag.`)
}

export function EmptyInterpolationExpression() {
    error("Empty interpolation expression block is not allowed.")
}

export function UseKeyDirectiveWithoutForDirective() {
    error("Key directive could not be used without for directive.")
}

export function DuplicateAttributeKey(tag: string, a: string, b: string) {
    let description = ""
    if (a[0] === "#") {
        error(`The directive(${a}) of ${tag} tag is duplicate.`)
    }
    if (a === b) {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
    } else {
        description = `${getSpecialAttrDescription(a[0])}(${a})`
        description += ` and ${getSpecialAttrDescription(b[0])}(${b})`
    }
    error(`The name for ${description} of ${tag} tag is duplicate.`)
}

export function InvalidSlotAttribute(typeChar: string) {
    const typeStr = typeChar === "!" ? "Dynamic" : "Reference"
    error(`${typeStr} slot attribute(${typeChar}slot) is not allowed.`)
}

export function DuplicateSlotAttributeValue(value: string) {
    error(`Multiple tags have the same slot attribute value(${value}).`)
}

export function EmbeddedScriptBlockOutOfLimit() {
    error(`The embedded script block is out of limit(only one is allowed).`)
}

export function CouldNotPassRefValue(key: string, tag: string) {
    error(`Can not pass any reference value(${key}) for normal tag(${tag}).`)
}

export function NoValueForRequiredValueAttribute(key: string) {
    const itemDescription = getSpecialAttrDescription(key[0])
    error(`The ${itemDescription}(${key}) must have a value.`)
}

export function NoBracketForAttributeInterpolation() {
    error("The interpolation attribute value must be wrapped with curly bracket.")
}

export function AttributeValueIsNotQuoted() {
    error("The normal attribute value must be quoted with single or double quote.")
}

export function DirectivesCantCoexist(directives: string[]) {
    error(`Directives(${directives.join(", ")}) can not be used simultaneously.`)
}

export function BadAttributeFormat(attr?: string) {
    error(`The attribute ${isUndefined(attr) ? "format" : `name(${attr})`} is bad.`)
}

export function InvalidSlotNameAttribute(typeChar: string) {
    const typeStr = typeChar === "!" ? "Dynamic" : "Reference"
    error(`${typeStr} name attribute(${typeChar}name) for slot tag is not allowed.`)
}

export function RegisterExsitingIdentifierName(name: string) {
    error(`The identifier name(${name}) to register already exists in the top scope.`)
}

export function SlotAttributeIsEmpty() {
    error("The Slot attribute can not be empty for the direct child of a component.")
}

export function MissingStartDirective(directive: string, startDirective: string) {
    error(`The ${directive} directive must be used after ${startDirective} directive.`)
}

export function CompilerFuncNotInTopScope() {
    error(
        "Reactivity related ompiler helper functions(rea, stc, der) must be used in the top scope."
    )
}

export function CantAcceptRefAttrWithSpecificDynamicAttr(tag: string, attr: string) {
    error(
        `The <${tag}> tag with dynamic ${attr} attribute(!${attr}) can not accept any reference attribute.`
    )
}

export function CompilerFuncWithoutVariableDeclaration() {
    error(
        "Reactivity related compiler helper functions(rea, stc, der) must be used for a variable declaration statement."
    )
}

export function IdentifierFormatIsNotAllowed(identifier: string) {
    error(
        `The identifier(${identifier}) format is not allowed, banned identifier format: /${bannedIdentifierFormat.source}/.`
    )
}

export function DestructureReactFuncWithNoArg(funcName: string) {
    error(
        `Compiler helper function(${funcName}) will return undefined when no argument is passed, so it cannot be destructured.`
    )
}

export function BadValueForRefAttr(exp: string) {
    error(
        `Only assignable expression(lvalue) can be passed to reference attribute, the given expression(${exp}) is not allowed.`
    )
}

export function NotAllowedRefAttrForNormalTag(tag: string, attr: string[], given: string) {
    const allowedAttrJoined = attr.join(" or ")
    const allowedAttrDescription = attr.map(item => "&" + item).join(", ")
    error(
        `Normal tag(${tag}) can only accept ${allowedAttrJoined} as reference attribute(${allowedAttrDescription}), and the given item(&${given}) is not allowed.`
    )
}

export class CompileError extends Error {
    declare Description: string

    constructor(msg: string) {
        super(msg)
        this.Description = "The QingKuai compiler encountered a fatal error during execution"
    }
}

function error(msg: string) {
    throw new CompileError(msg)
}

// 获取特殊属性的描述（指令、事件、动态即引用属性）
export function getSpecialAttrDescription(tc: string) {
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
