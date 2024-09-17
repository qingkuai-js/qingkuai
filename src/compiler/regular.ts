export const templateTag = /^"?template"?$/
export const templateStartTagRE = /^<([^\s>]+)/
export const templateAttributeRE = /^(\s*)([^\s=>]+)/
export const templateEndTagRE = /^<\/([^\s>]+)[^>]*>/
export const templateCloseCharsRE = /^(?:\s*)((\/)?>)/
export const templateInvalidAttrNameRE = /^['"=/<\{\}]/
export const templateNormalAttributeValueRE = /(\s*(['"]))([\s\S]*)\2/
export const templateConditionalCommentRE = /^(?:\[if.*\[endif]|\[if.*<!|<!\[endif])$/

export const kebabWholeRE = /^\w|-|(?<=-)\w/g
export const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g

export const reservedIndentifierName = /^(?:prop|ref)s$/
export const bannedIdentifierFormat = /^_(?:[sd]\d+|dn)_$/

export const tagIsComponentRE = /^[A-Z]|-/

export const expressionReplaceWithSpaceRE = /(?:\s|\r?\n)+/y

export const validIdentifierNameRE = /^[a-zA-Z_$][a-zA-Z_$\d]*$/

export const scriptSourceIndentSpaceCount = /\n( +)\S/
export const scriptSourceNeedIndentPlace = /(?<=^|\n)/g
export const scriptSourceRedundantEmptyLine = /^(?: *\r?\n)+|(?:\r?\n *)+(?=\r?\n *\r?\n)|\s+$/g
