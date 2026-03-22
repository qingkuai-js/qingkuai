import type {
    Range,
    TemplateNode,
    EventFlagInfo,
    CompileMessage,
    ComponentTagPart,
    TemplateAttribute,
    StandaloneParseTemplateOptions
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
     * 解析指令值源字符串：分离基础值与上下文模式\
     * Parse the raw directive value string: separate the base value and its context patterns.
     *
     * @param directive 需要解析的指令\
     * The directive to be parsed.
     *
     * @returns 包含基础值、关键字位置、模式以及解析错误/警告信息的对象\
     * An object containing the base value, keyword index, patterns, and any parsing errors/warnings.
     */
    (directive: TemplateAttribute): {
        base: string
        keywordIndex: number
        baseStartSourceIndex: number
        patterns: (ContextPattern | null)[]
        messages?: CompileMessage[]
    }
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

export interface ParseTemplateFunc {
    /**
     * 解析模板源代码为模板AST节点树\
     * Parse template source code into a tree of template AST nodes.
     *
     * 将输入的模板源代码递归解析为模板AST节点树。此方法会自动根据配置项进行相应的检查和过滤处理。
     * 当 recover 为 true 时，解析器会在遇到错误时 继续解析，而不是立即抛出异常，最后统一收集并报告所有错误。
     *
     * Recursively parses the input template source code into a tree of template AST nodes.
     * This method automatically performs corresponding checks and filtering based on configuration items.
     * When recover is true, the parser will continue parsing when errors are encountered instead of
     * throwing immediately, and will collect and report all errors at the end.
     *
     * @param source - 模板源代码字符串\
     * The template source code string to be parsed
     *
     * @param options - 解析选项配置对象\
     * Template parsing options configuration object
     *
     * @param options.recover - 是否在遇到错误时继续解析，默认为false。
     * 设为true会启用检查模式，收集所有错误后继续解析过程\
     * Whether to continue parsing when errors are encountered, defaults to false.
     * Setting to true enables check mode to collect all errors and continue parsing
     *
     * @param options.preserveBlankTextNodes - 是否保留空白文本节点，默认为true\
     * Whether to preserve blank text nodes, defaults to true
     *
     * @param options.preserveCommentNodes - 是否保留HTML注释节点，默认为false\
     * Whether to preserve HTML comment nodes, defaults to false
     *
     * @param options.checkEmptyInterpolation - 是否检查并报告空的插值表达式块\
     * Whether to check and report empty interpolation expression blocks
     *
     * @param options.checkAttributeValueEnclosure - 是否检查属性值是否正确被引号/花括号包裹\
     * Whether to check if attribute values are properly enclosed with quotes or braces
     *
     * @returns 解析后的模板AST节点数组，已过滤无效节点\
     * Array of parsed template AST nodes with invalid nodes filtered out
     *
     * @example
     * ```typescript
     * // Basic usage
     * const source = '<div #for={item, index of arr}>{ count }</div>';
     * const ast = parseTemplateStandalone(source);
     *
     * // Enable error recovery mode
     * const astWithRecovery = parseTemplateStandalone(source, {
     *   recover: true,
     *   checkEmptyInterpolation: true
     * });
     *
     * // Custom filtering options
     * const astCustom = parseTemplateStandalone(source, {
     *   preserveBlankTextNodes: false,
     *   preserveCommentNodes: true
     * });
     * ```
     *
     * @throws 在非恢复模式下，会抛出首个遇到的解析错误\
     * In non-recovery mode, throws the first parsing error encountered
     */
    (source: string, options?: StandaloneParseTemplateOptions): TemplateNode[]
}
