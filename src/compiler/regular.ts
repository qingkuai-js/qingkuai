export const tagCloseCharsRE = /^\/?>/
export const componentTagRE = /^[A-Z]|[-.]/
export const templateAttributeEndRE = /\s|>|$/
export const templateInvalidAttributeRE = /^[^\s>]+/
export const templateAttributeNameRE = /^[^\s='"\{\}><\/]+/
export const templateConditionalCommentRE = /(?:^\[if |<\!\[endif\]$)/
export const embeddedStyleLangRE = /^(?:css|s[ca]ss|less|stylus|postcss)$/
export const preWhiteSpaceRuleRE = /(?:^\s*|;)white-space:\s*pre(?:-(?:wrap|line))?(?:;|\s*$)/
export const templateTagStructureRE = /<(?:\/?(?:(?!qk:spread)[a-zA-z][a-zA-Z\d\-_.]*|qk:spread)|!--)/
export const embeddedLangTagRE = new RegExp(`^lang-([jt]s|${embeddedStyleLangRE.source.slice(4, -2)})$`)

export const whitespaceRE = /\s/
export const whitespacesRE = /\s*/
export const nonWhitespaceRE = /\S/
export const equalTokenRE = /^\s*=/
export const startCurlyRE = /^\s*\{/
export const endSemicolonRE = /;\s*$/
export const startQuoteRE = /^\s*['"]/
export const indentSpacesRE = /(?<=\n)(?:[ \t]+)/
export const interpolatedAttrStartCharRE = /[!@#&]/
export const omitQuoteAttrValueRE = /^[^\s'"`=<>]+$/
export const shouldBeSelectedAttrStartCharRE = /[!@&]/

export const atLeastOneWhitespaceRE = /\s+/g
export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const jsValueCharRE = /[A-Za-z0-9_$]/
export const jsStringLiteralQuoteRE = /[`'"]/
export const jsDestructuringEqualTokenRE = /\s*=\s*/
export const jsValidIdentifierRE = /^[A-Za-z_$][A-Za-z0-9_$]*$/
export const jsStartRegexKeywordsRE = /(?:return|throw|case|delete|void|typeof|await)$/ // TODO: convert to a set of keywords

// TODO: These regexes need to be converted into constant sets.
export const cannotRedeclareStatusRE = /^(?:derived|alias)$/
export const intrinsicVariableRE = /^(?:props|refs|slots|contexts|instance)$/
export const intrinsicWatchExpMethodsRE = /^(?:watch|(?:pre|post|sync)Watch)Exp$/
export const intrinsicReactiveMethodsRE = /^(?:raw|reactive|shallow|derived(?:Exp)?|alias)$/
export const intrinsicEffectWatchMethodsRE = /^(?:effect|watch|(?:pre|post|sync)(?:Effect|Watch))$/
export const shouldBeCheckedIntrinsicMethodsRE = /^(?:raw|reactive|shallow|derived(?:Exp)?|alias|defaults|setContextExp|(?:watch|(?:pre|post|sync|)Watch)Exp)$/
export const intrinsicMethodsRE =
    /^(?:raw|reactive|shallow|derived(?:Exp)?|alias|defaults|setContext(?:Exp|Getter)?|(?:watch|(?:pre|post|sync|)Watch)(?:Exp)?|on(?:AfterMount|(?:Before|After)(?:Update|Destroy)))$/

export const keyboardEventNamesRE = /^key(?:up|down|press)$/ // TODO: convert to a set of event names.
export const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)

export const formattingPreWhitespaceRE = /^\n?[\s]*\n/
export const formattingUselessWhitespaceRE = /^[ \t]*/

export const expressionParseErrorNoReportRE = /^'[)]' expected\.$/
