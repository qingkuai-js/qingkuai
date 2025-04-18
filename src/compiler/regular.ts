export const templateCloseCharsRE = /^(?:\s*)((\/)?>|$)/
export const templateAttributeNameRE = /^[^\s='"\{\}></]+/
export const templateInvalidAttributeNameRE = /^[='"\{\}></][^\s>]*/
export const templateTagStructureRE = /<(?:\/?[a-zA-z][a-zA-Z\d\-_.:]*|!--)/
export const templateConditionalCommentRE = /^(?:\[if.*\[endif]|\[if.*<!|<!\[endif])$/
export const templateEmbeddedLangTagRE = /^lang-([jt]s|css|s[ca]ss|less|stylus|postcss)/

export const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)

export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const bannedIdentifierFormatRE = /^__w__|__(?:[sd]\d+|dn|c)__$/

export const tagIsComponentRE = /^[A-Z]|-/
export const stringLiteralConstantRE = /__s(\d+\.)?\d+__/
export const tirNormalClassItemRE = /\[?__s\d+__(?:, )?\]?/g

export const reactCompilerFuncRE = /^(?:rea|stc|der)$/
export const watchCompilerFuncRE = /^(?:wat|Wat|waT)$/
export const validIdentifierNameRE = /^[a-zA-Z_$][a-zA-Z_$\d]*$/

export const scriptSourceIndentSpaceCount = /\n( +)\S/
export const scriptSourceNeedIndentPlace = /(?<=^|\n)/g
export const scriptSourceRedundantEmptyLine = /^(?: *\r?\n)+|(?:\r?\n *)+(?=\r?\n *\r?\n)|\s*$/g

export const preWhiteSpaceCommentRE = /(?:^\s*|;)white-space:\s*pre(?:-(?:wrap|line))?(?:;|\s*$)/
