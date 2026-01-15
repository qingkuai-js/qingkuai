export const templateCloseCharsRE = /^\/?>/
export const templateInvalidAttributeRE = /^[^\s>]+/
export const templateAttributeNameRE = /^[^\s='"\{\}><\/]+/
export const templateConditionalCommentRE = /(?:^\[if |<\!\[endif\]$)/
export const templateTagStructureRE = /<(?:\/?[a-zA-z][a-zA-Z\d\-_.:]*|!--)/
export const templateEmbeddedLangTagRE = /^lang-([jt]s|css|s[ca]ss|less|stylus|postcss)/

export const indentSpacesRE = /(?<=\n) +/
export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const bannedIdentifierRE = /^(?:__w__|__c__$)/
export const intrinsicVariableRE = /^props|refs|slots$/
export const intrinsicReactiveMethodsRE = /^raw|reactive|shallow|derived$/
export const intrinsicMethodsRE = /^raw|reactive|shallow|derived|default(?:Props|Refs)$/

export const tagIsComponentRE = /^[A-Z]|-/
export const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)
export const preWhiteSpaceRuleRE = /(?:^\s*|;)white-space:\s*pre(?:-(?:wrap|line))?(?:;|\s*$)/
