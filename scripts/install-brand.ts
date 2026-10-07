// 将品牌声明（src/types/brand.d.ts）以软链接注入 node_modules，伪装成外部包
// @qingkuai/virtual/brand，因为 api-extractor 对外部包保留 import 而非内联，
// 从而保证品牌符号的单一数据源与同一性（内联会导致各入口的 unique symbol 副本分裂
// 名义类型）。软链接使注入内容与源声明恒为同一文件，不存在拷贝漂移。
//
// 挂载于 postinstall，构建时 build-types.ts 将 brand.d.ts 发布至
// dist/types/language-service/ 并把各产物中的包名改写为相对路径；虚拟包不随发布物输出，
// 且该路径不在 exports 子路径内，用户不可达。
//
// Injects the brand declarations (src/types/brand.d.ts) into node_modules as
// a symlink, disguising them as an external package @qingkuai/virtual/brand,
// because api-extractor preserves imports for external packages instead of
// inlining, keeping a single source and identity for the brand symbols
// (inlining would duplicate the unique symbols per entry and split the
// nominal identity). The symlink keeps the injected file identical to the
// source declaration, so there is no copy drift.
//
// Wired as the postinstall hook, at build time build-types.ts publishes
// brand.d.ts to dist/types/language-service/ and rewrites the package name
// in every shipped declaration to the relative path; the virtual package is never
// shipped, and the path is not an exports subpath, keeping it unreachable by users.

import fsExtra from "fs-extra"
import nodeUrl from "node:url"
import nodePath from "node:path"

const PWD = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))
const SOURCE_BRAND_DTS = nodePath.resolve(PWD, "../src/types/brand.d.ts")
const VIRTUAL_BRAND_DTS = nodePath.resolve(PWD, "../node_modules/@qingkuai/virtual/brand.d.ts")

// 以软链接注入，目标为相对路径（仓库迁移/克隆后依然有效）；链接与源声明恒为
// 同一文件，无拷贝漂移
// Injected as a symlink whose target is relative (survives repository
// relocation and cloning); the link always mirrors the source declaration —
// no copy drift
fsExtra.ensureDirSync(nodePath.dirname(VIRTUAL_BRAND_DTS))
if (fsExtra.pathExistsSync(VIRTUAL_BRAND_DTS)) {
    fsExtra.removeSync(VIRTUAL_BRAND_DTS)
}
fsExtra.symlinkSync(
    nodePath.relative(nodePath.dirname(VIRTUAL_BRAND_DTS), SOURCE_BRAND_DTS),
    VIRTUAL_BRAND_DTS,
    "file"
)
