export const templateCloseCharsRE = /^\/?>/
export const templateInvalidAttributeRE = /^[^\s>]+/
export const templateAttributeNameRE = /^[^\s='"\{\}><\/]+/
export const templateConditionalCommentRE = /(?:^\[if |<\!\[endif\]$)/
export const templateTagStructureRE = /<(?:\/?[a-zA-z][a-zA-Z\d\-_.:]*|!--)/
export const templateEmbeddedLangTagRE = /^lang-([jt]s|css|s[ca]ss|less|stylus|postcss)/

export const indentSpacesRE = /(?<=\n) +/
export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const intrinsicVariableRE = /^props|refs|slots$/
export const forbiddenIdentifierRE = /^(?:__w__|__c__$)/
export const intrinsicWatcherMethodsRE = /^watch|(?:pre|post|sync)Watch$/
export const intrinsicReactiveMethodsRE = /^raw|reactive|shallow|derived|alias$/
export const intrinsicMethodsRE =
    /^raw|reactive|shallow|derived|alias|default(?:Props|Refs)|watch|(?:pre|post|sync|)Watch$/

export const tagIsComponentRE = /^[A-Z]|-/
export const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)
export const preWhiteSpaceRuleRE = /(?:^\s*|;)white-space:\s*pre(?:-(?:wrap|line))?(?:;|\s*$)/
