import type {
    Range,
    TemplateNode,
    EventFlagInfo,
    CompileMessage,
    ComponentTagPart,
    TemplateAttribute
} from "#type-declarations/compiler"
import type { ContextPattern } from "#type-declarations/estree"

export interface Camel2KebabFunc {
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
    (str: string, allowFullLower?: boolean): string
}

export interface Kebab2CamelFunc {
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
    (str: string, startWithUppercase?: boolean): string
}

export interface ToPropertyKeyFunc {
    /**
     * 将字符串转换为合法的 JavaScript 对象属性键：
     * - 如果可以作为普通属性（无需引号）使用，则原样返回
     * - 否则返回字符串字面量（带引号）
     *
     * Convert a string to a valid JavaScript object property key.
     * - If the string can be used as a plain property (unquoted), return it as-is;
     * - otherwise, return it as a quoted string literal.
     *
     * 典型用途：在代码生成或AST实用程序中生成对象键\
     * Typical use: generating object keys in code generation or AST utilities.
     *
     * @param str 要转换的字符串\
     * The input string to normalize as a property key
     *
     * @returns 合法对象属性键（原始字符串或带引号字符串）\
     * A valid object property key (string or quoted string literal)
     */
    (str: string): string
}

export interface FindEndBracketFunc {
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

export interface ParseDirectiveValueFunc {
    /**
     * 解析带有上下文模式的指令值，目前需要此方法解析的指令有：`#for` 和 `#slot`\
     * Parse directive values with contextual patterns. Currently, this is required for directives such as `#for` and `#slot`.
     *
     * @param directive 需要解析的指令\
     * The directive value to be parsed.
     *
     * 注意：此方法在遇到无效（不满足于 ContextPattern 类型）的模式时会抛出错误，需避免程序错误可以考虑使用 try-catch 块捕获此异常\
     * Note: This method will throw an error when encountering an invalid pattern(i.e., one that does not satisfy the ContextPattern type).
     * To prevent runtime errors, consider using a try-catch block to handle this exception.
     */
    (directive: TemplateAttribute):
        | {
              base: string
              keywordIndex: number
              baseStartSourceIndex: number
              patterns: (ContextPattern | null)[]
          }
        | undefined
}

export interface ParseEventFlagFunc {
    /**
     * 解析事件名称源字符串：分离事件名称与事件标志\
     * Parse the raw event name string: separate the event name and its flags.
     *
     * @param source 需要解析的事件\
     * The event to be parsed.
     *
     * @returns 包含事件名称、事件标志以及解析错误/警告信息的对象\
     * An object containing the event name, event flags, and any parsing errors/warnings.
     */
    (event: TemplateAttribute): {
        eventName: string
        generalFlag: EventFlagInfo
        wrapperFlag: EventFlagInfo
        messages?: CompileMessage[]
    }
}

export interface ParseComponentTagFunc {
    /**
     * 解析组件标签名为多个组成部分，并记录每一部分在源码中的位置\
     * Parses a component tag name into multiple parts and records the source position of each part.
     *
     * 该函数用于处理类似 `Foo.Bar.Baz` 的组件标签名。标签名会按 `.` 分割，每一部分会被转换为 camelCase 标识符，并生成对应的源码范围信息\
     * This function processes component tag names such as `Foo.Bar.Baz`. The tag name is split by `.`, and each segment
     * is converted into a camelCase identifier while preserving its source range.
     *
     * @param componentNode 组件节点\
     * The component node.
     *
     * @returns 返回一个 ComponentTagPart 数组，数组中的每一项包含：
     * - `id`：转换为 camelCase 后的组件标识符
     * - `sourceRange`：该部分在源码中的起止索引 `[start, end]`
     *
     * An array of ComponentTagPart objects. Each item contains:
     * - `id`: the camelCase identifier of the component segment
     * - `sourceRange`: the `[start, end]` source index range of that segment
     *
     */
    (componentNode: TemplateNode): ComponentTagPart[]
}
