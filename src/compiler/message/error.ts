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

export function SlotNameAttributeIsEmpty() {
    error("The name attribute for slot tag can not be empty.")
}

export function TagCantBeSelfClosing(tag: string) {
    error(`The tag(${tag}) can not be used as self closing tag.`)
}

export function EmptyInterpolationExpression() {
    error("Empty interpolation expression block is not allowed.")
}

export function UsedKeyDirectiveWithoutForDirective() {
    error("Key directive could not be used without for directive.")
}

export function GeneralTagJustAcceptAutoAsReference(tag: string) {
    error(`General tag(${tag}) can only accept auto as reference.`)
}

export function InvalidSlotAttribute(type: number) {
    const typeChar = type === 1 ? "!" : "&"
    const typeStr = type === 1 ? "Dynamic" : "Reference"
    error(`${typeStr} slot attribute(${typeChar}slot) is not allowed.`)
}

export function DuplicateSlotAttributeValue(value: string) {
    error(`Multiple tags have the same slot attribute value(${value}).`)
}

export function EmbeddedScriptBlockOutOfLimit() {
    error(`The embedded script block is out of limit(only one is allowed).`)
}

export function CouldNotPassRefValue(key: string, tag: string) {
    error(`Can not pass any reference value(${key}) for general tag(${tag}).`)
}

export function NoValueForRequiredValueAttribute(key: string, type: number) {
    const itemDescription = getCompileRelatedAttributeDescription(type)
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

export function EmptyAttributeName(char: string) {
    const charTypeMap = { "#": 1, "@": 2, "!": 3, "&": 4 } as any
    const itemDescription = getCompileRelatedAttributeDescription(charTypeMap[char])
    error(`The ${itemDescription!} must be specified a name.`)
}

export function InvalidSlotNameAttribute(type: number) {
    const typeChar = type === 1 ? "!" : "&"
    const typeStr = type === 1 ? "Dynamic" : "Reference"
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

export function ReferenceValueCantBeUsedWithDynamicType(tag: string) {
    error(
        `Can not pass reference value when general tag(${tag}) using dynamic type attribute(!type).`
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

export class CompileError extends Error {
    Description: string
    constructor(msg: string) {
        super(msg)
        this.Description = "The QingKuai compiler encountered a fatal error during execution"
    }
}

function error(msg: string) {
    throw new CompileError(msg)
}

function getCompileRelatedAttributeDescription(type: number) {
    if (type === 1) {
        return "directive"
    } else if (type === 2) {
        return "event listener"
    } else if (type === 3) {
        return "dynamic attribute"
    } else if (type === 4) {
        return "reference attribute"
    }
}
