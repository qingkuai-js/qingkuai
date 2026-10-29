// 复制进消费项目后由 node 直接执行：验证 exports 的 `require` 条件把三个子路径都解析到
// CJS 产物且能运行。导出集合与 ESM 是否一致由 esm-check.mjs 逐名比对，这里不重复
//
// Copied into the consumer project and executed by node to verify that the `require`
// condition resolves all three subpaths to the CJS build. Export-set parity with ESM is
// compared name by name in esm-check.mjs and is not repeated here.

const runtime = require("qingkuai")
const internal = require("qingkuai/internal")
const { compile } = require("qingkuai/compiler")

if (!Object.keys(runtime).length) {
    throw new Error("qingkuai exported nothing through require")
}
if (!Object.keys(internal).length) {
    throw new Error("qingkuai/internal exported nothing")
}

const result = compile("<div>{ count }</div>")
if (result.messages.length) {
    const count = result.messages.length
    const first = result.messages[0].value
    const at = `${first.loc.start.line}:${first.loc.start.column}`
    throw new Error(`Compiler reported ${count} message(s), first at ${at}: ${first.message}`)
}
if (!result.code) {
    throw new Error("Compiler returned empty code")
}

const stats = [
    `runtime=${Object.keys(runtime).length}`,
    `internal=${Object.keys(internal).length}`,
    `bytes=${result.code.length}`
]
console.log(stats.join(" "))
