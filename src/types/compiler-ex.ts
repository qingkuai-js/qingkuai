import type { ContextPattern } from "#type-declarations/estree"
import type { EventFlagInfo, Range } from "#type-declarations/compiler"

/**
 * 驼峰命名转串型命名 \
 * Convert camelCase to kebab-case
 *
 * @param str 需要被转换的字符串 \
 * The string to be converted
 *
 * @param allowFullLower 是否允许转换结果为全小写 \
 * Whether the result is allowed to be fully lowercase
 */
export interface Camel2KebabFunc {
    (str: string, allowFullLower?: boolean): string
}

/**
 * 串型命名转驼峰命名 \
 * Convert kebab-case to camelCase
 *
 * @param str 需要被转换的字符串 \
 * The string to be converted
 *
 *
 * @param startWithUppercase 是否需要将首字符转换为大写 \
 * Whether the first character should be converted to uppercase
 */
export interface Kebab2CamelFunc {
    (str: string, startWithUppercase?: boolean): string
}

/**
 * 在 Javascript 源码中找到对应关闭括号的索引 \
 * Find the index of the matching closing bracket in Javascript source code
 *
 * @param str 待查找的字符串，其首字符必须为三种开始括号之一： `(`、`{`、`[` \
 * The string to be searched; its first character must be one of the three opening brackets: `(`, `{`, or `[`
 *
 * @returns 与首字符对应关闭括号的索引，未找到时为-1 \
 * The index of the closing bracket that matched the first character, returns -1 if not found
 */
export interface FindEndBracketFunc {
    (str: string): number
}

export interface FindOutOfLiteralFunc {
    /**
     * 在 Javascript 源码中脱离字符串/正则字面量范围查找匹配项，注意：模板字符串的插值部分不会被忽略 \
     * Search for matches outside of string/regexp literals in JavaScript source code;
     * Note: the interpolated parts of template strings will not be ignored
     *
     * @param str 被检索的 Javascript 源码字符串 \
     * The JavaScript source code string to be searched
     *
     * @param substr 要查找的子串 \
     * The substring to search for
     *
     * @param startIndex 可选的起始索引，从该索引位置向后检索 \
     * Optional starting index from which the search begins
     *
     * @returns 查找到的匹配项的索引位置，未找到时返回-1 \
     * The index of the found match; returns -1 if no match is found
     */
    (str: string, substr: string, startIndex?: number): number

    /**
     * 在 Javascript 源码中脱离字符串/正则字面量范围查找匹配项，注意：模板字符串的插值部分不会被忽略 \
     * Search for matches outside of string/regexp literals in JavaScript source code;
     * Note: the interpolated parts of template strings will not be ignored
     *
     * @param str 被检索的 Javascript 源码字符串 \
     * The JavaScript source code string to be searched
     *
     * @param pattern 用于检索匹配的正则表达式 \
     * The regular expression used for matching
     *
     * @param startIndex 可选的起始索引，从该索引位置向后检索 \
     * Optional starting index from which the search begins
     *
     * @returns 由查找到的匹配项的索引和字符数量组成的数组，未查找到时返回 [-1, 0] \
     * The index and count of characters of the found match; returns [-1, 0] if no match is found
     */
    (str: string, pattern: RegExp, startIndex?: number): Range
}

export interface FindOutOfCommentFunc {
    /**
     * 在 Javascript 源码中脱离注释范围查找匹配项
     * Search for matches outside of comment in JavaScript source code
     *
     * @param str 被检索的 Javascript 源码字符串 \
     * The JavaScript source code string to be searched
     *
     * @param substr 要查找的子串 \
     * The substring to search for
     *
     * @param startIndex 可选的起始索引，从该索引位置向后检索 \
     * Optional starting index from which the search begins
     *
     * @returns 查找到的匹配项的索引位置，未找到时返回-1 \
     * The index of the found match; returns -1 if no match is found
     */
    (str: string, substr: string, startIndex?: number): number

    /**
     * 在 Javascript 源码中脱离注释范围查找匹配项
     * Search for matches outside of comment in JavaScript source code
     *
     * @param str 被检索的 Javascript 源码字符串 \
     * The JavaScript source code string to be searched
     *
     * @param pattern 用于检索匹配的正则表达式 \
     * The regular expression used for matching
     *
     * @param startIndex 可选的起始索引，从该索引位置向后检索 \
     * Optional starting index from which the search begins
     *
     * @returns 由查找到的匹配项的索引和字符数量组成的数组，未查找到时返回 [-1, 0] \
     * The index and count of characters of the found match; returns [-1, 0] if no match is found
     */
    (str: string, pattern: RegExp, startIndex?: number): Range
}

export interface FindOutOfLiteralCommentFunc {
    /**
     * 在 Javascript 源码中脱离字符串/正则字面量和注释范围查找匹配项，注意：模板字符串的插值部分不会被忽略 \
     * Search for matches outside of string/regexp literals and comment in JavaScript source code;
     * Note: the interpolated parts of template strings will not be ignored
     *
     * @param str 被检索的 Javascript 源码字符串 \
     * The JavaScript source code string to be searched
     *
     * @param substr 要查找的子串 \
     * The substring to search for
     *
     * @param startIndex 可选的起始索引，从该索引位置向后检索 \
     * Optional starting index from which the search begins
     *
     * @returns 查找到的匹配项的索引位置，未找到时返回-1 \
     * The index of the found match; returns -1 if no match is found
     */
    (str: string, substr: string, startIndex?: number): number

    /**
     * 在 Javascript 源码中脱离字符串/正则字面量和注释范围查找匹配项，注意：模板字符串的插值部分不会被忽略 \
     * Search for matches outside of string/regexp literals and comment in JavaScript source code;
     * Note: the interpolated parts of template strings will not be ignored
     *
     * @param str 被检索的 Javascript 源码字符串 \
     * The JavaScript source code string to be searched
     *
     * @param pattern 用于检索匹配的正则表达式 \
     * The regular expression used for matching
     *
     * @param startIndex 可选的起始索引，从该索引位置向后检索 \
     * Optional starting index from which the search begins
     *
     * @returns 由查找到的匹配项的索引和字符数量组成的数组，未查找到时返回 [-1, 0] \
     * The index and count of characters of the found match; returns [-1, 0] if no match is found
     */
    (str: string, pattern: RegExp, startIndex?: number): Range
}

/**
 * 解析带有上下文模式的指令值，目前需要此方法解析的指令有：`#for` 和 `#slot`\
 * Parse directive values with contextual patterns. Currently, this is required for directives such as `#for` and `#slot`.
 *
 * @param source 需要解析的指令值\
 * The directive value to be parsed.
 *
 * @param keyword 分割上下文模式和表达式的关键字\
 * The keyword that separates the contextual pattern from the expression.
 *
 * @param startSourceIndex 指令值在源码中的起始索引（用于报错，警告）\
 * The starting index of the directive value in the source code (used for errors and warnings).
 *
 * 注意：此方法在遇到无效（不满足于 ContextPattern 类型）的模式时会抛出错误，需避免程序错误可以考虑使用 try-catch 块捕获此异常\
 * Note: This method will throw an error when encountering an invalid pattern(i.e., one that does not satisfy the ContextPattern type).
 * To prevent runtime errors, consider using a try-catch block to handle this exception.
 */
export interface ParseDirectiveValueFunc {
    (
        source: string,
        keyword: string,
        startSourceIndex?: number
    ): {
        base: string
        keywordIndex: number
        baseStartSourceIndex: number
        patterns: (ContextPattern | null)[]
    }
}

/**
 * 解析事件名称源字符串：分离事件名称与事件标志\
 * Parse the raw event name string: separate the event name and its flags.
 *
 * @param source 需要解析的事件名称源字符串（含标志）\
 * The raw event name string to be parsed (including flags).
 *
 * @param startSourceIndex 事件名称在源码中的起始索引（用于报错，警告）\
 * The starting index of the event name in the source code (used for errors and warnings).
 *
 * 注意：此方法在遇到冲突、未识别的标志等情况时会抛出错误，需避免程序错误可以考虑使用 try-catch 块捕获此异常\
 * Note: This method will throw an error when encountering conflicts, unrecognized modifiers, or similar issues.
 * To prevent runtime errors, consider using a try-catch block to handle this exception.
 */
export interface ParseEventFlagFunc {
    (
        source: string,
        startSourceIndex?: number
    ): {
        eventName: string
        flagInfo: EventFlagInfo
    }
}
