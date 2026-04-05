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
     * 将 camelCase 或 PascalCase 形式的字符串转换为 kebab-case。\
     * Convert a camelCase or PascalCase string to kebab-case.
     *
     * 典型用途：在编译阶段将组件名、属性名或其他标识符转换为适合
     * HTML 或代码生成的串型名称。\
     * Typical use: convert component names, attribute names, or other
     * identifiers into kebab-case names for HTML or code generation.
     *
     * 当 `allowFullLower` 为 `false` 时，若首字符后不再出现大写字母，
     * 则保留原字符串。\
     * When `allowFullLower` is `false`, the original string is kept if
     * no uppercase letter appears after the first character.
     *
     * @param str 需要转换的字符串。\
     * The source string to convert.
     *
     * @param allowFullLower 是否允许结果为整串小写，默认为 `true`。\
     * Whether an all-lowercase result is allowed. Defaults to `true`.
     *
     * @returns 转换后的 kebab-case 字符串，或按配置保留的原字符串。\
     * The converted kebab-case string, or the original string when it is
     * preserved by configuration.
     *
     * Examples:
     * ```ts
     * // Convert a camelCase identifier.
     * camel2Kebab("userName")
     * // => "user-name"
     * ```
     *
     * ```ts
     * // Keep a single uppercase identifier unchanged.
     * camel2Kebab("A", false)
     * // => "A"
     * ```
     */
    (str: string, allowFullLower?: boolean): string
}

export interface Kebab2CamelFunc {
    /**
     * 将 kebab-case 字符串转换为 camelCase 或 PascalCase。\
     * Convert a kebab-case string to camelCase or PascalCase.
     *
     * 典型用途：把模板中的标签名或属性名转换为适合脚本访问的
     * JavaScript 标识符。\
     * Typical use: turn template tag names or attribute names into
     * JavaScript identifiers that are easier to access in code.
     *
     * 连续的连字符和尾部连字符会在转换时被忽略。\
     * Consecutive hyphens and trailing hyphens are ignored during
     * conversion.
     *
     * @param str 需要转换的字符串。\
     * The source string to convert.
     *
     * @param startWithUppercase 是否将首字母也转换为大写，默认为 `false`。\
     * Whether to uppercase the first letter as well. Defaults to `false`.
     *
     * @returns 转换后的 camelCase 或 PascalCase 字符串。\
     * The converted camelCase or PascalCase string.
     *
     * Examples:
     * ```ts
     * // Convert to camelCase.
     * kebab2Camel("user-name")
     * // => "userName"
     * ```
     *
     * ```ts
     * // Convert to PascalCase.
     * kebab2Camel("user-name", true)
     * // => "UserName"
     * ```
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
     * 典型用途：在代码生成或 AST 实用工具中输出可直接拼接到对象字面量
     * 中的属性键。\
     * Typical use: produce property keys that can be inserted directly
     * into generated object literals.
     *
     * @param str 要转换的字符串。\
     * The input string to normalize as a property key.
     *
     * @returns 合法的对象属性键，可能是原始标识符，也可能是带引号的
     * 字符串字面量。\
     * A valid object property key, either the original identifier or a
     * quoted string literal.
     *
     * Examples:
     * ```ts
     * // Valid identifiers stay unquoted.
     * toPropertyKey("userName")
     * // => "userName"
     * ```
     *
     * ```ts
     * // Invalid identifiers are quoted.
     * toPropertyKey("user-name")
     * // => '"user-name"'
     * ```
     */
    (str: string): string
}

export interface FindEndBracketFunc {
    /**
     * 在 JavaScript 源码片段中找到首字符对应的关闭括号位置。\
     * Find the closing bracket index that matches the first character in
     * a JavaScript source fragment.
     *
     * 典型用途：解析插值表达式、属性值或其他以括号开头的源码片段，
     * 同时跳过字符串、正则和注释中的干扰内容。\
     * Typical use: parse interpolation expressions, attribute values, or
     * other bracketed source fragments while skipping strings, regular
     * expressions, and comments.
     *
     * @param str 待查找的字符串，其首字符必须是 `(`、`{`、 `[` 或 `<` 之一。\
     * The source string to inspect. Its first character must be `(`, `{`,
     * `[`, or `<`.
     *
     * @returns 与首字符匹配的关闭括号索引；若未找到则返回 `-1`。\
     * The index of the closing bracket that matches the first character,
     * or `-1` if no match is found.
     *
     * @throws 当首字符不是受支持的开始括号时抛出异常。\
     * Throws when the first character is not a supported opening bracket.
     *
     * Examples:
     * ```ts
     * // Nested brackets are resolved correctly.
     * findEndBracket("{a + (b * c)}")
     * // => 12
     * ```
     *
     * ```ts
     * // Brackets inside comments are ignored.
     * findEndBracket("{ a + // }\n b }")
     * // => 14
     * ```
     */
    (str: string): number
}

export interface FindOutOfLiteralFunc {
    /**
     * 在 JavaScript 源码中查找位于字符串和正则字面量之外的子串。\
     * Search JavaScript source for a substring that appears outside of
     * string and regexp literals.
     *
     * 典型用途：在表达式中定位关键字、分隔符或操作符，同时避免匹配到
     * 字面量内部的同名内容。模板字符串的插值部分仍会参与搜索。\
     * Typical use: locate keywords, separators, or operators in an
     * expression without matching the same text inside literals. Template
     * string interpolations are still searched.
     *
     * @param str 被检索的 JavaScript 源码字符串。\
     * The JavaScript source code string to search.
     *
     * @param substr 要查找的子串。\
     * The substring to search for.
     *
     * @param startIndex 可选起始索引，搜索会从该位置及其之后开始。\
     * Optional start index. The search begins at or after this position.
     *
     * @returns 匹配项的起始索引；未找到时返回 `-1`。\
     * The starting index of the match, or `-1` if no valid match is found.
     *
     * Examples:
     * ```ts
     * // Ignore text inside string literals.
     * findOutOfLiteral('"test" value', 'value')
     * // => 7
     * ```
     *
     * ```ts
     * // Still search inside template interpolations.
     * findOutOfLiteral('`a ${count + 1}`', 'count')
     * // => 5
     * ```
     */
    (str: string, substr: string, startIndex?: number): number

    /**
     * 按与上方相同的规则在 JavaScript 源码中查找正则匹配项。\
     * Search JavaScript source for a RegExp match using the same rules as
     * above.
     *
     * @param str 被检索的 JavaScript 源码字符串。\
     * The JavaScript source code string to search.
     *
     * @param pattern 用于检索匹配的正则表达式。\
     * The regular expression used for matching.
     *
     * @param startIndex 可选起始索引，搜索会从该位置及其之后开始。\
     * Optional start index. The search begins at or after this position.
     *
     * @returns `[索引, 长度]` 形式的结果；未找到时返回 `[-1, 0]`。\
     * A tuple in the form `[index, length]`, or `[-1, 0]` if no valid
     * match is found.
     *
     * Examples:
     * ```ts
     * // Return both the match position and matched length.
     * findOutOfLiteral('"test" value', /value/)
     * // => [7, 5]
     * ```
     */
    (str: string, pattern: RegExp, startIndex?: number): Range
}

export interface FindOutOfCommentFunc {
    /**
     * 在 JavaScript 源码中查找位于注释之外的子串。\
     * Search JavaScript source for a substring that appears outside of
     * comments.
     *
     * 典型用途：在保留字符串字面量语义的前提下，跳过行注释和块注释来
     * 查找源码片段。\
     * Typical use: search source text while skipping line and block
     * comments but still treating string literals as normal text.
     *
     * @param str 被检索的 JavaScript 源码字符串。\
     * The JavaScript source code string to search.
     *
     * @param substr 要查找的子串。\
     * The substring to search for.
     *
     * @param startIndex 可选起始索引，搜索会从该位置及其之后开始。\
     * Optional start index. The search begins at or after this position.
     *
     * @returns 匹配项的起始索引；未找到时返回 `-1`。\
     * The starting index of the match, or `-1` if no valid match is found.
     *
     * Examples:
     * ```ts
     * // Ignore content inside comments.
     * findOutOfComment('// test\nvalue', 'value')
     * // => 8
     * ```
     */
    (str: string, substr: string, startIndex?: number): number

    /**
     * 按与上方相同的规则在 JavaScript 源码中查找正则匹配项。\
     * Search JavaScript source for a RegExp match using the same rules as
     * above.
     *
     * @param str 被检索的 JavaScript 源码字符串。\
     * The JavaScript source code string to search.
     *
     * @param pattern 用于检索匹配的正则表达式。\
     * The regular expression used for matching.
     *
     * @param startIndex 可选起始索引，搜索会从该位置及其之后开始。\
     * Optional start index. The search begins at or after this position.
     *
     * @returns `[索引, 长度]` 形式的结果；未找到时返回 `[-1, 0]`。\
     * A tuple in the form `[index, length]`, or `[-1, 0]` if no valid
     * match is found.
     *
     * Examples:
     * ```ts
     * // Return the first match outside comments.
     * findOutOfComment('// skip\nvalue', /value/)
     * // => [8, 5]
     * ```
     */
    (str: string, pattern: RegExp, startIndex?: number): Range
}

export interface FindOutOfLiteralCommentFunc {
    /**
     * 在 JavaScript 源码中查找位于字面量和注释之外的子串。\
     * Search JavaScript source for a substring that appears outside of
     * literals and comments.
     *
     * 典型用途：解析脚本表达式或指令值时，排除字符串、正则、行注释
     * 和块注释中的干扰匹配。模板字符串的插值部分仍会参与搜索。\
     * Typical use: parse script expressions or directive values while
     * excluding matches inside strings, regular expressions, line comments,
     * and block comments. Template string interpolations are still searched.
     *
     * @param str 被检索的 JavaScript 源码字符串。\
     * The JavaScript source code string to search.
     *
     * @param substr 要查找的子串。\
     * The substring to search for.
     *
     * @param startIndex 可选起始索引，搜索会从该位置及其之后开始。\
     * Optional start index. The search begins at or after this position.
     *
     * @returns 匹配项的起始索引；未找到时返回 `-1`。\
     * The starting index of the match, or `-1` if no valid match is found.
     *
     * Examples:
     * ```ts
     * // Ignore both literals and comments.
     * findOutOfLiteralComment('"test" // skip\nvalue', 'value')
     * // => 15
     * ```
     */
    (str: string, substr: string, startIndex?: number): number

    /**
     * 按与上方相同的规则在 JavaScript 源码中查找正则匹配项。\
     * Search JavaScript source for a RegExp match using the same rules as
     * above.
     *
     * @param str 被检索的 JavaScript 源码字符串。\
     * The JavaScript source code string to search.
     *
     * @param pattern 用于检索匹配的正则表达式。\
     * The regular expression used for matching.
     *
     * @param startIndex 可选起始索引，搜索会从该位置及其之后开始。\
     * Optional start index. The search begins at or after this position.
     *
     * @returns `[索引, 长度]` 形式的结果；未找到时返回 `[-1, 0]`。\
     * A tuple in the form `[index, length]`, or `[-1, 0]` if no valid
     * match is found.
     *
     * Examples:
     * ```ts
     * // Return the first match outside literals and comments.
     * findOutOfLiteralComment('"test" // skip\nvalue', /value/)
     * // => [15, 5]
     * ```
     */
    (str: string, pattern: RegExp, startIndex?: number): Range
}

export interface ParseDirectiveValueFunc {
    /**
     * 解析指令值源码，分离基础表达式与前置上下文模式。\
     * Parse a directive value and split it into the base expression and
     * leading context patterns.
     *
     * 典型用途：解析 `#for` 和 `#slot` 这类形如“模式 + 关键字 + 表达式”
     * 的指令值。搜索关键字时会跳过字面量和注释。\
     * Typical use: parse directive values such as `#for` and `#slot`
     * whose syntax is `pattern + keyword + expression`. Literal and
     * comment ranges are skipped while searching for the keyword.
     *
     * 如果未找到可用的关键字分隔位置，或前置模式无法被识别，则会把
     * 整个值视为基础表达式，并返回空模式列表。\
     * If no usable keyword split is found, or the leading pattern cannot
     * be recognized, the whole value is treated as the base expression and
     * an empty pattern list is returned.
     *
     * @param directive 需要解析的模板指令属性。\
     * The template directive attribute to parse.
     *
     * @returns 包含基础表达式、关键字位置、模式列表，以及可选诊断信息
     * 的对象。\
     * An object containing the base expression, keyword index, parsed
     * patterns, and optional diagnostics.
     *
     * Examples:
     * ```ts
     * // Assume `directive` represents `#for={item of list}`.
     * // Its value is `item of list`.
     * const directive: TemplateAttribute = getForDirective()
     *
     * const result = parseDirectiveValue(directive)
     * console.log(result.base) // 'list'
     * console.log(result.keywordIndex) // 4
     * ```
     */
    (directive: TemplateAttribute): {
        base: string
        keywordIndex: number
        baseStartSourceIndex: number
        patterns: ContextPattern[]
        messages?: CompileMessage[]
    }
}

export interface ParseEventFlagFunc {
    /**
     * 解析事件属性名，分离事件名与事件标志。\
     * Parse an event attribute name into the event name and its flags.
     *
     * 典型用途：分析 `@click|once|stop` 这类事件声明，并将普通标志与
     * 包装器标志分别归类。\
     * Typical use: analyze event declarations such as `@click|once|stop`
     * and separate general flags from wrapper flags.
     *
     * 当存在重复、冲突或无法识别的标志时，带检查能力的实现可以附带
     * 诊断信息。\
     * When flags are duplicated, conflicting, or unrecognized, checking
     * variants may attach diagnostics.
     *
     * @param event 需要解析的事件属性。\
     * The event attribute to parse.
     *
     * @returns 包含事件名称、普通标志、包装器标志，以及可选诊断信息
     * 的对象。\
     * An object containing the event name, general flags, wrapper flags,
     * and optional diagnostics.
     *
     * Examples:
     * ```ts
     * // Assume `event` represents `@click|once|stop`.
     * const event: TemplateAttribute = getClickEventAttribute()
     *
     * const result = parseEventFlag(event)
     * console.log(result.eventName) // '@click'
     * console.log(result.generalFlag.items.map(item => item.name))
     * // => ['once', 'stop']
     * ```
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
     * 将组件标签名拆分为多个组成部分，并记录每一部分的源码范围。\
     * Split a component tag name into multiple parts and record the source
     * range of each part.
     *
     * 该函数用于处理类似 `Foo.Bar.Baz` 或 `foo-bar.baz-qux` 的组件
     * 标签名。每一段都会被转换为 camelCase 标识符。\
     * This function handles component tag names such as `Foo.Bar.Baz` or
     * `foo-bar.baz-qux`. Each segment is converted to a camelCase
     * identifier.
     *
     * @param componentNode 需要解析标签名的组件节点。\
     * The component node whose tag name should be parsed.
     *
     * @returns 一个 `ComponentTagPart` 数组；每一项都包含转换后的标识符
     * 以及它在源码中的范围。\
     * An array of `ComponentTagPart` objects. Each item contains the
     * converted identifier and its source range.
     *
     * Examples:
     * ```ts
     * // Assume `componentNode.tag` is `foo-bar.baz-qux`.
     * const componentNode: TemplateNode = getComponentNode()
     *
     * const parts = parseComponentTag(componentNode)
     * console.log(parts.map(part => part.id))
     * // => ['fooBar', 'bazQux']
     * ```
     */
    (componentNode: TemplateNode): ComponentTagPart[]
}

export interface ParseTemplateFunc {
    /**
     * 将模板源码解析为模板 AST 节点树。\
     * Parse template source code into a tree of template AST nodes.
     *
     * 典型用途：在独立工具、测试或编译前置处理中解析一段模板源码，
     * 并按选项决定是否保留空白文本、注释节点以及是否启用额外检查。\
     * Typical use: parse template snippets in standalone tools, tests, or
     * preprocessing steps, while controlling whether blank text nodes,
     * comment nodes, and additional checks are enabled.
     *
     * 当 `recover` 为 `true` 时，解析过程会启用检查模式，尽量继续向后
     * 解析，而不是在首个错误处立即中断。\
     * When `recover` is `true`, the parser runs in checking mode and
     * tries to continue instead of stopping at the first error.
     *
     * @param source 模板源码字符串。\
     * The template source code string to parse.
     *
     * @param options 解析选项。\
     * Parsing options.
     *
     * @param options.recover 是否在出错后继续解析，默认为 `false`。\
     * Whether parsing should continue after an error. Defaults to `false`.
     *
     * @param options.preserveBlankTextNodes 是否保留空白文本节点，
     * 默认为 `true`。\
     * Whether blank text nodes should be preserved. Defaults to `true`.
     *
     * @param options.preserveCommentNodes 是否保留 HTML 注释节点。
     * 未显式关闭时会保留。\
     * Whether HTML comment nodes should be preserved. They are preserved
     * unless explicitly disabled.
     *
     * @param options.checkEmptyInterpolation 是否检查并报告空插值表达式。\
     * Whether to check and report empty interpolation expressions.
     *
     * @param options.checkAttributeValueEnclosure 是否检查属性值是否使用了
     * 正确的引号或花括号包裹。\
     * Whether to check that attribute values use the correct quotes or
     * braces.
     *
     * @returns 解析后的模板 AST 节点数组；无效节点会按配置被过滤。\
     * The parsed template AST node array. Invalid nodes are filtered
     * according to the active options.
     *
     * @example
     * ```ts
     * // Basic usage
     * const source = '<div #for={item, index of arr}>{ count }</div>'
     * const ast = parseTemplate(source)
     *
     * // Enable error recovery mode
     * const astWithRecovery = parseTemplate(source, {
     *   recover: true,
     *   checkEmptyInterpolation: true
     * })
     *
     * // Custom filtering options
     * const astCustom = parseTemplate(source, {
     *   preserveBlankTextNodes: false,
     *   preserveCommentNodes: true
     * })
     * ```
     *
     * @throws 在非恢复模式下，遇到不可恢复的解析错误时会抛出异常。\
     * In non-recovery mode, throws when an unrecoverable parsing error is
     * encountered.
     */
    (source: string, options?: StandaloneParseTemplateOptions): TemplateNode[]
}

export interface FormatSourceCodeFunc {
    /**
     * 对模板字符串中书写的代码文本进行缩进规范化处理。\
     * Normalize indentation in code text written inside template strings.
     *
     * 用模板字符串书写代码时，缩进层级会受到当前文件位置的影响，导致
     * 生成的代码字符串中出现多余的前导空格。此方法以首行前导空格数为
     * 基准，对全文统一移除等量的前导空格。开头和结尾处的空白行也会被
     * 一并移除。\
     * When writing code inside a template string, the indentation is
     * affected by the file position and may introduce unwanted leading
     * spaces. This method removes all leading spaces from the first line
     * and strips the same amount from each remaining line. Blank lines
     * at the beginning and end are also removed.
     *
     * @param source 代码文本字符串。\
     * The code text string to normalize.
     *
     * @returns 缩进规范化后的代码字符串。\
     * The normalized code string with adjusted indentation.
     *
     * Examples:
     * ```ts
     * // Strip indentation from a template string code block.
     * const code = formatSourceCode(`
     *     function foo() {
     *         return 1
     *     }
     * `)
     * // => "function foo() {\n    return 1\n}"
     * ```
     */
    (source: string): string
}
