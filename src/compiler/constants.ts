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
    "embed"
])

export const fullRuntimeItems = new Set([
    "QingKuaiComponent",
    "nil",
    "raw",
    "init",
    "noop",
    "react",
    "derived",
    "nextTick",
    "ifModule",
    "forModule",
    "constReact",
    "aliasModule",
    "awaitModule",
    "keyedForModule",
    "eventWrapper",
    "withReference",
    "destructuringReact",
    "constDestructuringReact"
])

export const fullInitItems = new Set(["scts", "props"])

export const compilerFuncs = new Set(["rea", "stc", "der"])

export const specialTags = new Set(["!", "script", "style"])

export const couldUseRefTags = new Set(["input", "select", "textarea"])

export const watchRelatedFuncs = new Set(["watch", "preWatch", "syncWatch"])

export const mustPassValueDirectives = new Set(["if", "elif", "for", "await", "for", "key", "slot"])
