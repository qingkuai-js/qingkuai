---
name: export-docs
description: "为导出的 JavaScript/TypeScript 函数或标识符添加或改进 JSDoc。适用于 public API、导出工具函数、重载签名、回调函数契约文档。关键词: JSDoc, exported function, API docs."
argument-hint: "要为哪些文件或导出 API 添加注释？"
---

# 添加导出函数注释

## 这个 Skill 的产出

为目标导出函数补充高质量 JSDoc，并且不改变任何运行时行为。

## 适用场景

- 文件中存在缺失注释或注释质量较低的导出函数。
- 需要统一不同模块的 public API 文档风格。
- 重载签名或回调契约需要明确参数语义。
- 需要“简洁但准确”的注释，并与实现保持一致。

## 工作流程

1. 识别目标导出函数。
2. 阅读实现和调用点，确认真实行为、副作用与边界情况。
3. 判断函数定位与受众：

- public API：重点写清语义、约束、返回契约。
- internal export：可更简短，强调非显而易见行为。

4. 按函数形态选择注释粒度：

- 简单函数：摘要 + @param + @returns。
- 异步函数：补充异步时序与 resolve 后返回值语义。
- 回调函数：说明回调触发时机与参数含义。
- 重载函数：先写共享行为，再补充各重载差异。

5. 编写注释：

- 先写动作导向的一句话摘要。
- 描述对调用方有价值的契约，不堆实现细节。
- 涉及默认值、单位、可空/可选时明确写出。
- 仅当调用方可观察到异常时才使用 @throws。
- compiler 包下的注释需要中英文对照注释，runtime 包下的注释只需要英文。
- 函数注释开头简要描述函数作用与典型使用场景，结尾处添加1 ~ 3 个使用示例，用 ts 代码块，使用示例中也要添加一些必要的解释性注释。
- 函数示例中需要使用其他关联方法时，不确定关联方法的使用细节时，必须从文档查阅： https://qingkuai.dev，确保示例中使用的 API 都是正确的。

6. 保持 API 与代码稳定：

- 未明确要求时，不改函数逻辑或签名。
- 保持与周边代码一致的格式与风格。

7. 质量校验：

- 注释与真实行为一致。
- JSDoc 参数名与函数签名参数名完全一致。
- 返回值描述与实际返回内容/时机一致。
- 如项目有类型或文档校验流程，执行相应检查。
- qingkuai 的格式为 Qingkuai。
- 注释行宽限制为80字符，若只超出较少字符，请尽量精简语句以写在一行，精简不了就需要换行。
- JSDoc 中的泛型和参数类型不用写，因为这就是在为 ts 文件添加注释。

## 决策规则

- 仅看实现仍不明确时，先查调用点再写注释。
- 项目中不能明确具体行为时，参考文档： https://qingkuai.dev。
- 行为依赖调度/时序时，必须明确触发时机。
- 暂无稳定契约时，先写最小中性描述，并标记待确认点。
- 注释与代码冲突时，告诉我此处存在问题，等我确认后再修改。
- 发现潜在行为变更时，先告诉我再修改。

## 完成检查清单

- 每个目标导出函数都有新增或改进后的 JSDoc。
- 不使用模板化空话，每条注释都对应真实函数契约。
- 未引入任何行为变更。
- 编辑文件的诊断结果保持干净。
- 确保注释中语句通顺。

## 示例提示词

- 为 src/runtime/event.ts 中所有导出函数补充 JSDoc。
- 改进 src/types/runtime-ex.ts 里的导出 API 注释并统一术语。
- 为 src/compiler/parser 下导出解析函数补充重载行为说明。

## 示例

````ts
/**
 * Watches reactive dependencies accessed inside a getter function and
 * invokes a callback whenever any of them change.
 *
 * The `callback` receives the previous value and the updated value each time
 * the reactive dependencies of the getter are updated. This allows
 * side-effects, logging, or other reactions to changes in reactive state.
 *
 * @param getter A function that accesses reactive dependencies. The watcher will track
 *
 * @param callback A function that is called with the old and new values whenever
 * the reactive dependencies accessed by the getter change.
 *
 * @returns The returned object provides controls for managing the watcher:
 * - `stop()` completely stops the watcher and releases resources.
 * - `pause()` temporarily suspends invoking the callback.
 * - `resume()` resumes a previously paused watcher.
 *
 * Examples:
 * ```ts
 * const watcher = watch(
 *   () => state.count,
 *   (oldVal, newVal) => {
 *     console.log(`count changed from ${oldVal} to ${newVal}`)
 *   }
 * )
 *
 * state.count = 1 // console logs: "count changed from 0 to 1"
 *
 * watcher.pause()
 * state.count = 2 // callback not called
 *
 * watcher.resume()
 * state.count = 3 // console logs: "count changed from 2 to 3"
 *
 * watcher.stop()
 * state.count = 4 // callback not called
 * ```
 *
 * ```ts
 * // Watching multiple dependencies inside a getter
 * const watcher = watch(
 *   () => state.count + state.multiplier,
 *   (oldVal, newVal) => {
 *     console.log(`combined value changed from ${oldVal} to ${newVal}`)
 *   }
 * )
 * ```
 */
export function watch<T>(getter: Getter<T>, callback: WatchEffectCallback<T>): EffectHandle {
    // implementation...
}
````
