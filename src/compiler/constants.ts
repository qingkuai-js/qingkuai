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
    EVENT_PASSIVE
} from "../runtime/constants"
import { objectAssign } from "../util/shared/aliases"

export const SPREAD_TAG = "qk:spread"

export const EVENT_FLAGS_MAP: Record<string, number> = {
    once: EVENT_ONCE,
    stop: EVENT_STOP,
    self: EVENT_SELF,
    prevent: EVENT_PREVENT,
    capture: EVENT_CAPTURE,
    passive: EVENT_PASSIVE,

    tab: KEY_TAB,
    enter: KEY_ENTER,
    delete: KEY_DELETE,
    escape: KEY_ESCAPE,
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

export const ATTRIBUTE_PRIORITY_MAP: Record<string, number> = [
    ["#key", "#for"],
    ["#slot", "#target"],
    ["#if", "#elif", "#else"],
    ["#await", "#then", "#catch"]
].reduce(
    (ret, items, index) => {
        for (const item of items) {
            objectAssign(ret, {
                [item]: index + 1
            })
        }
        return ret
    },
    { name: 100 }
)

export const CONFLICTING_EVENT_FLAG_MAP: Record<string, string[]> = {
    passive: ["prevent"],
    prevent: ["passive"]
}

export const CONFLICTING_DIRECTIVES_MAP: Record<string, string[]> = {
    "#then": ["#catch"],
    "#catch": ["#then"],
    "#slot": ["#target"],
    "#if": ["#elif", "#else"],
    "#elif": ["#if", "#else"],
    "#else": ["#if", "#elif"]
}

export const SELF_CLOSING_TAGS = new Set([
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

export const BLOCK_TAGS = new Set([
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

export const REQUIRED_VALUE_DIRECTIVES = new Set([
    "#if",
    "#elif",
    "#for",
    "#await",
    "#for",
    "#key",
    "#slot",
    "#show",
    "#target"
])
export const DIRECTIVE_LIST = new Set([
    "#if",
    "#elif",
    "#else",
    "#for",
    "#key",
    "#await",
    "#then",
    "#catch",
    "#slot",
    "#show",
    "#html",
    "#target"
])
export const DISALLOWED_TAGS = new Set(["html", "head", "body", "frame", "frameset"])
