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
    "wbr"
])

export const MUST_PASS_VALUE_DIRECTIVES = new Set([
    "if",
    "elif",
    "for",
    "await",
    "for",
    "key",
    "slot"
])

export const KEY_RELATED_EVENT_MODIFIERS = new Set([
    "enter",
    "tab",
    "del",
    "esc",
    "up",
    "down",
    "left",
    "right",
    "space",
    "shift"
])

export const FULL_RUNTIME_ITEMS = new Set([
    "QingKuaiComponent",
    "noop",
    "nil",
    "raw",
    "init",
    "nextTick",
    "react",
    "watch",
    "preWatch",
    "syncWatch",
    "derived",
    "ifModule",
    "forModule",
    "constReact",
    "keyedForModule",
    "aliasModule",
    "awaitModule",
    "eventWrapper",
    "withReference",
    "unescapeModule",
    "destructuringReact",
    "destructuringDerived",
    "constDestructuringReact"
])

export enum IntercodeSnippetKind {
    VoidSource = -3,
    SearchForward = -2,
    SearchBackward = -1
}

export const SPREAD_TAG = "template"

export const SPECIAL_TAGS = new Set(["!", "script", "style"])

export const FULL_INIT_ITEMS = new Set(["args", "scts", "props"])

export const COULD_USE_REF_TAGS = new Set(["input", "select", "textarea"])

export const COMPILER_FUNCS = new Set(["rea", "stc", "der", "wat", "Wat", "waT"])
