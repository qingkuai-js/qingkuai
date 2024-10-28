export const selfClosingTags = new Set([
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

export const keyRelatedEventModifiers = new Set([
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

export const fullRuntimeItems = new Set([
    "QingKuaiComponent",
    "noop",
    "nil",
    "raw",
    "init",
    "nextTick",
    "react",
    "derived",
    "ifModule",
    "forModule",
    "constReact",
    "keyedForModule",
    "aliasModule",
    "awaitModule",
    "eventWrapper",
    "withReference",
    "destructuringReact",
    "constDestructuringReact"
])

export const compilerFuncs = new Set(["rea", "stc", "der"])

export const specialTags = new Set(["!", "script", "style"])

export const fullInitItems = new Set(["args", "scts", "props"])

export const couldUseRefTags = new Set(["input", "select", "textarea"])

export const watchRelatedFuncs = new Set(["watch", "preWatch", "syncWatch"])

export const mustPassValueDirectives = new Set(["if", "elif", "for", "await", "for", "key", "slot"])
