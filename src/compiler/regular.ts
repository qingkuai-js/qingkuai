export const TemplateEmbeddedLangTag = /^lang-[a-z]*/
export const templateCloseCharsRE = /^(?:\s*)((\/)?>)/
export const templateAttributeNameRE = /^[^\s='"\{\}></]+/
export const templateAttributeValueRE = /^(['"])([\s\S]*?)\1/
export const templateInvalidAttributeNameRE = /^[='"\{\}></][^\s>]+/
export const templateTagStructureRE = /<(?:\/?[a-zA-z][a-zA-Z\d\-_.:]*|!--)/
export const templateConditionalCommentRE = /^(?:\[if.*\[endif]|\[if.*<!|<!\[endif])$/

export const startWithTagStructureRE = new RegExp("^" + templateTagStructureRE.source)

export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const bannedIdentifierFormatRE = /^_(?:[sd]\d+|dn)_$/

export const tagIsComponentRE = /^[A-Z]|-/

export const SlotDirectiveRE = /^slot(?::|$)/
export const DestructuringContextRE = /^[\{\[]/

export const expressionReplaceWithSpaceRE = /(?:\s|\r?\n)+/y

export const validIdentifierNameRE = /^[a-zA-Z_$][a-zA-Z_$\d]*$/

export const scriptSourceIndentSpaceCount = /\n( +)\S/
export const scriptSourceNeedIndentPlace = /(?<=^|\n)/g
export const scriptSourceRedundantEmptyLine = /^(?: *\r?\n)+|(?:\r?\n *)+(?=\r?\n *\r?\n)|\s*$/g
