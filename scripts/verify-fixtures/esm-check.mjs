// 复制进消费项目后由 node 直接执行：裸模块名按本文件位置解析，指向刚安装的 tarball
// Copied into the consumer project and executed by node: bare specifiers resolve
// against this file's location, which points at the freshly installed tarball.

function filterAndSort(names, predicate) {
    const result = []
    for (const name of names) {
        if (predicate(name)) {
            result.push(name)
        }
    }
    return result.sort()
}

const EXPECTED_EXPORTS = [
    "watch",
    "effect",
    "version",
    "nextTick",
    "mountApp",
    "toReactive",
    "noTracking",
    "createStore",
    "createShallowStore",
    "batchAndNoTracking"
]
const COMPILED_IMPORT_RE = /from "(qingkuai(?:\/[a-z-]+)?)"/g

const runtime = await import("qingkuai")
const missing = EXPECTED_EXPORTS.filter(name => !(name in runtime))
if (missing.length) {
    throw new Error(`Missing runtime exports: ${missing.join(", ")}`)
}

const internal = await import("qingkuai/internal")
if (!Object.keys(internal).length) {
    throw new Error("qingkuai/internal exported nothing")
}

const { compile } = await import("qingkuai/compiler")
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

const compiledSources = [...result.code.matchAll(COMPILED_IMPORT_RE)].map(match => match[1])
const dependencies = [...new Set(compiledSources)]
for (const dependency of dependencies) {
    await import(dependency)
}

const { createRequire } = await import("node:module")
const cjs = createRequire(import.meta.url)("qingkuai")
const esmOnly = filterAndSort(Object.keys(runtime), name => !(name in cjs))
const cjsOnly = filterAndSort(Object.keys(cjs), name => !(name in runtime))
if (esmOnly.length || cjsOnly.length) {
    const [esmDiff, cjsDiff] = [esmOnly, cjsOnly].map(item => item.join(", "))
    throw new Error(`ESM and CJS export sets diverge: only-esm=${esmDiff} only-cjs=${cjsDiff}`)
}

const stats = [
    `runtime=${Object.keys(runtime).length}`,
    `internal=${Object.keys(internal).length}`,
    `bytes=${result.code.length}`,
    `deps=${dependencies.join(",")}`
]
console.log(stats.join(" "))
