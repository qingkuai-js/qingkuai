import type {
    AttributeValueEnclosure,
    StandaloneParseTemplateOptions
} from "#type-declarations/compiler"

import {
    KEY_UP,
    KEY_DOWN,
    KEY_LEFT,
    KEY_RIGHT,
    KEY_TAB,
    KEY_ENTER,
    KEY_SPACE,
    KEY_DELETE,
    KEY_ESCAPE,
    KEY_META,
    KEY_ALT,
    KEY_CTRL,
    KEY_SHIFT,
    KEY_EXACT,
    EVENT_ONCE,
    EVENT_STOP,
    EVENT_SELF,
    EVENT_PREVENT,
    EVENT_CAPTURE,
    EVENT_PASSIVE,
    FRAG_WITH_TARGET,
    FRAG_WHOLE_CONTENT,
    FRAG_ORPHAN_CONTENT,
    FRAG_LEADING_ANCHOR
} from "../util/shared/flags"
import { objectAssign } from "../util/shared/aliases"

export const SPREAD_TAG = "qk:spread"
export const PRESERVED_IDPREFIX = "__qk__"

// Language Service Constants
export const LSC = {
    UTIL: PRESERVED_IDPREFIX + "lsu",
    COMPONENT: PRESERVED_IDPREFIX + "component",
    GET_TYPE_DELAY_MARKING: PRESERVED_IDPREFIX + "lsu.getTypeDelayMarking"
}

export const EVENT_FLAGS_MAP: Readonly<Record<string, number>> = {
    once: EVENT_ONCE,
    stop: EVENT_STOP,
    self: EVENT_SELF,
    prevent: EVENT_PREVENT,
    capture: EVENT_CAPTURE,
    passive: EVENT_PASSIVE,

    tab: KEY_TAB,
    enter: KEY_ENTER,
    delete: KEY_DELETE,
    esc: KEY_ESCAPE,
    space: KEY_SPACE,
    up: KEY_UP,
    down: KEY_DOWN,
    left: KEY_LEFT,
    right: KEY_RIGHT,

    meta: KEY_META,
    alt: KEY_ALT,
    ctrl: KEY_CTRL,
    shift: KEY_SHIFT,
    exact: KEY_EXACT
}

export const ATTRIBUTE_PRIORITY_MAP: Readonly<Record<string, number>> = [
    "#html",
    "#key",
    "#for",
    "#target",
    "#else",
    "#elif",
    "#if",
    "#catch",
    "#then",
    "#await",
    "#slot",
    "name"
].reduce((ret, name, index) => {
    return objectAssign(ret, {
        [name]: index + 1
    })
}, {})

export const PARSER_TEMPLATE_OPTIONS: StandaloneParseTemplateOptions = {
    checkTemplateStructure: true,
    preserveBlankTextNodes: true,
    checkEmptyInterpolation: true,
    checkAttributeValueEnclosure: true
}

export const FRAG_FLAG_INTERPRETIVE_MAP: Readonly<Record<number, string>> = {
    [FRAG_WHOLE_CONTENT]: "WHOLE_CONTENT",
    [FRAG_LEADING_ANCHOR]: "LEADING_ANCHOR",
    [FRAG_ORPHAN_CONTENT]: "ORPHAN_CONTENT",
    [FRAG_WITH_TARGET]: "WITH_TARGET_DIRECTIVE"
}

export const CONFLICTING_EVENT_FLAG_MAP: Readonly<Record<string, string[]>> = {
    passive: ["prevent"],
    prevent: ["passive"]
}

export const CONFLICTING_DIRECTIVES_MAP: Readonly<Record<string, string[]>> = {
    "#then": ["#catch"],
    "#catch": ["#then"],
    "#slot": ["#target"],
    "#if": ["#elif", "#else"],
    "#elif": ["#if", "#else"],
    "#else": ["#if", "#elif"]
}

export const ATTRIBUTE_VALUE_ENCLOSURE_MAP: Record<string, AttributeValueEnclosure> = {
    "{": "curly",
    "'": "single",
    '"': "double"
}

export const BLOCK_TAGS: ReadonlySet<string> = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "footer",
    "header",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hgroup",
    "main",
    "nav",
    "section",
    "dl",
    "dt",
    "dd",
    "ol",
    "ul",
    "li",
    "table",
    "caption",
    "colgroup",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    "form",
    "fieldset",
    "legend",
    "figure",
    "figcaption",
    "hr",
    "pre",
    "details",
    "dialog",
    "summary",
    "center",
    "frameset",
    "noframes"
])

export const VOID_TAGS: ReadonlySet<string> = new Set([
    "br",
    "img",
    "input",
    "meta",
    "link",
    "hr",
    "base",
    "area",
    "col",
    "embed",
    "param",
    "source",
    "track",
    "wbr",
    "frame",
    "isindex",
    "basefont"
])

export const DELEGATABLE_EVENTS: ReadonlySet<string> = new Set([
    "beforeinput",
    "change",
    "click",
    "copy",
    "cut",
    "contextmenu",
    "dbclick",
    "drag",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "dragstart",
    "drop",
    "input",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
    "paste",
    "pointercancel",
    "pointerdown",
    "pointermove",
    "pointerout",
    "pointerover",
    "pointerup",
    "select",
    "selectionchange",
    "selectstart",
    "touchcancel",
    "touchend",
    "touchmove",
    "touchstart"
])

export const DISALLOWED_TAGS: ReadonlySet<string> = new Set([
    "html",
    "head",
    "body",
    "frame",
    "frameset"
])
export const DIRECTIVE_LIST: ReadonlySet<string> = new Set([
    "#if",
    "#elif",
    "#else",
    "#for",
    "#key",
    "#scope",
    "#await",
    "#then",
    "#catch",
    "#slot",
    "#html",
    "#target"
])
export const CREATE_ANCHOR_DIRECTIVES: ReadonlySet<string> = new Set([
    "#if",
    "#for",
    "#key",
    "#await",
    "#target"
])

export const REQUIRED_VALUE_DIRECTIVES: ReadonlySet<string> = new Set([
    "#if",
    "#elif",
    "#for",
    "#await",
    "#for",
    "#key",
    "#slot",
    "#target"
])

export const JS_RESERVED_KEYWORDS: ReadonlySet<string> = new Set([
    "break",
    "case",
    "catch",
    "continue",
    "debugger",
    "default",
    "do",
    "else",
    "finally",
    "for",
    "function",
    "if",
    "return",
    "switch",
    "throw",
    "try",
    "var",
    "const",
    "while",
    "with",
    "new",
    "this",
    "super",
    "class",
    "extends",
    "export",
    "import",
    "null",
    "true",
    "false",
    "in",
    "instanceof",
    "typeof",
    "void",
    "delete",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield"
])
