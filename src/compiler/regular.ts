export const tagIsComponentRE = /^[A-Z]|-/
export const templateCloseCharsRE = /^\/?>/
export const templateAttributeEndRE = /\s|>|$/
export const templateInvalidAttributeRE = /^[^\s>]+/
export const templateAttributeNameRE = /^[^\s='"\{\}><\/]+/
export const templateConditionalCommentRE = /(?:^\[if |<\!\[endif\]$)/
export const templateTagStructureRE = /<(?:\/?[a-zA-z][a-zA-Z\d\-_.:]*|!--)/
export const templateEmbeddedLangTagRE = /^lang-([jt]s|css|s[ca]ss|less|stylus|postcss)/
export const preWhiteSpaceRuleRE = /(?:^\s*|;)white-space:\s*pre(?:-(?:wrap|line))?(?:;|\s*$)/

export const whitespaceRE = /\s/
export const whitespacesRE = /\s*/
export const nonWhitespaceRE = /\S/
export const equalTokenRE = /^\s*=/
export const startCurlyRE = /^\s*\{/
export const startQuoteRE = /^\s*['"]/
export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const indentSpacesRE = /(?<=\n)(?:[ \t]+)/
export const interpolatedAttrStartCharRE = /[!@#&]/
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const jsValueCharRE = /[A-Za-z0-9_$]/
export const jsStringLiteralQuoteRE = /[`'"]/
export const jsDestructuringEqualTokenRE = /\s*=\s*/
export const jsValidIdentifierStartCharRE = /[a-zA-Z_$]/
export const jsStartRegexKeywordsRE = /(?:return|throw|case|delete|void|typeof|await)$/

export const intrinsicVariableRE = /^(?:props|refs|slots)$/
export const cannotRedeclareStatusRE = /^(?:derived|alias)$/
export const intrinsicWatcherMethodsRE = /^(?:watch|(?:pre|post|sync)Watch)$/
export const intrinsicReactiveMethodsRE = /^(?:raw|reactive|shallow|derived|alias)$/
export const intrinsicMethodsRE =
    /^(?:raw|reactive|shallow|derived|alias|default(?:Props|Refs)|watch|(?:pre|post|sync|)Watch)$/

export const keyboardEventNamesRE = /^key(?:up|down|press)$/
export const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)

export const testingPreWhitespaceRE = /\n?[\s]*\n/
export const testingUselessWhitespaceRE = /^[ \t]*/

export const babelErrorLocInfoRE = /\(\d+:\d+\)$/
