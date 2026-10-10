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
const SOURCE_TYPES_DIR = nodePath.dirname(SOURCE_BRAND_DTS)
const VIRTUAL_DIR = nodePath.resolve(PWD, "../node_modules/@qingkuai/virtual")
const VIRTUAL_BRAND_DTS = nodePath.join(VIRTUAL_DIR, "brand.d.ts")

// 上一次注入可能仍留在原地，且有两种形态：指向源码目录的目录联接（见下方 Windows 回退），
// 或真实目录内的文件软链接。两者都必须整体移除——尤其是联接，穿过它去移除其中的
// brand.d.ts 会删掉真实的源声明
// A leftover injection may still be present, in either shape: a directory junction
// to the source directory (the Windows fallback below), or a file symlink inside a
// real directory. Both must be removed as a whole — removing brand.d.ts through a
// junction would delete the real source declaration.
if (isSymbolicLink(VIRTUAL_DIR)) {
    fsExtra.removeSync(VIRTUAL_DIR)
}
fsExtra.ensureDirSync(VIRTUAL_DIR)
if (fsExtra.pathExistsSync(VIRTUAL_BRAND_DTS)) {
    fsExtra.removeSync(VIRTUAL_BRAND_DTS)
}

try {
    // 以软链接注入，目标为相对路径（仓库迁移/克隆后依然有效）；链接与源声明恒为
    // 同一文件，无拷贝漂移
    // Injected as a symlink whose target is relative (survives repository
    // relocation and cloning); the link always mirrors the source declaration —
    // no copy drift
    fsExtra.symlinkSync(nodePath.relative(VIRTUAL_DIR, SOURCE_BRAND_DTS), VIRTUAL_BRAND_DTS, "file")
} catch (error) {
    // Windows 未开启开发者模式（且未以管理员身份运行）时，创建文件软链接会失败于 EPERM。
    // 此时退化为将 src/types 以目录联接（junction）挂载为虚拟包目录：junction 不需要特权，
    // 且解析到同一真实路径，注入内容仍是同一文件，品牌符号的单一性不受影响。不能用拷贝
    // 替代——拷贝会让同一 unique symbol 分裂成两份名义类型。
    // On Windows without developer mode, creating a file symlink fails with EPERM.
    // Fall back to mounting src/types as a directory junction, which needs no
    // privilege and resolves to the same real path, so the injected file stays
    // identical and the brand symbols keep a single identity. A copy is not an
    // option: it would split the unique symbols into two nominal types.
    if (process.platform !== "win32") {
        throw error
    }
    fsExtra.removeSync(VIRTUAL_DIR)
    fsExtra.symlinkSync(SOURCE_TYPES_DIR, VIRTUAL_DIR, "junction")
    console.log(
        "[install-brand] file symlinks are not permitted; mounted src/types as a directory junction instead"
    )
}

function isSymbolicLink(path: string) {
    try {
        return fsExtra.lstatSync(path).isSymbolicLink()
    } catch {
        return false
    }
}
