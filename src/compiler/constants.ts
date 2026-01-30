export const SPREAD_TAG = "qk:spread"

export const ATTRIBUTE_PRIORITY_MAP: Record<string, number> = [
    "#key",
    "#for",
    "#slot",
    "#target",
    "#else",
    "#elif",
    "#if",
    "#then",
    "#catch",
    "#await",
    "name"
].reduce((ret, name, index) => {
    return {
        ...ret,
        [name]: index + 1
    }
}, {})

export const CONFLICT_DIRECTIVES_MAP: Record<string, string[]> = {
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
