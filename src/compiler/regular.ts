export const templateTag = /^"?template"?$/
export const templateCloseTagRE = /^(?:\s*)((\/)?>)/
export const templateContentRE = /(?:[\s\S](?<!<))*/
export const templateStartTagRE = /^<((?:\S(?<!>))+)/
export const templateEndTagRE = /^<\/((?:\S(?<!>))+)[^>]*>/
export const conditionalCommentRE = /^(?:\[if.*\[endif]|\[if.*<!|<!\[endif])$/
export const templateAttributeRE = /^(\s*)((?:\S(?<!=|>))+)\s*(?:=\s*(['"])([\s\S]*?)\3)?/

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
