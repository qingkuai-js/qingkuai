// 发布前验证 npm tarball 是否真的可用：解包清单、install 期钩子剥离、真实
// 安装、各入口的 ESM/CJS 加载，以及每个入口的类型声明可被消费者编译。
//
// Verify that the packed npm tarball is actually usable: tarball contents,
// stripped install-time hooks, a real consumer install, ESM/CJS loading of
// every entry, and type declarations that a consumer can actually compile.
//
// Usage: tsx scripts/verify-package.ts [path/to/qingkuai-x.y.z.tgz]

import nodeFs from "node:fs"
import nodeOs from "node:os"
import nodePath from "node:path"
import nodeUrl from "node:url"
import nodeChildProcess from "node:child_process"

import { normalizePath, readJson, readSync, writeJson } from "../src/util/scripts/sundry"

interface Failure {
    name: string
    details: string
}

const failures: Failure[] = []

// 仓库自身的 package.json 按脚本位置定位，与 tarball 的查找目录（当前工作目录）解耦
// The repository's own package.json is located relative to this script, decoupled
// from the directory the tarball is looked up in (the working directory).
const SCRIPT_DIR = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))
const REPO_PACKAGE_PATH = nodePath.resolve(SCRIPT_DIR, "../package.json")

const RUNTIME_CHECKS = [
    {
        name: "ESM entries load and the compiler round-trips",
        fixture: "esm-check.mjs"
    },
    {
        name: "CJS entries load and the compiler round-trips",
        fixture: "cjs-check.cjs"
    }
] as const
const TARBALL_RE = /^qingkuai-\d+\.\d+\.\d+\.tgz$/
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"
const INSTALL_CHECK = "tarball installs into an empty project"
const FIXTURE_DIR = nodePath.join(SCRIPT_DIR, "verify-fixtures")
const FORBIDDEN_ENTRY_PREFIXES = ["scripts/", "dist/temp-types/"]
const NPM_INSTALL_FLAGS = ["--no-audit", "--no-fund", "--loglevel=error"]
const ALLOWED_TOP_LEVEL = ["package.json", "LICENSE", "README.md", "dist/"]
const INSTALL_TIME_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"] as const

function indent(text: string): string {
    const indented: string[] = []
    const lines = text.split("\n")
    for (const line of lines) {
        indented.push(line ? `        ${line}` : line)
    }
    return indented.join("\n")
}

function isAllowedEntry(relativePath: string): boolean {
    for (const allowed of ALLOWED_TOP_LEVEL) {
        if (relativePath === allowed) {
            return true
        }
        if (allowed.endsWith("/") && relativePath.startsWith(allowed)) {
            return true
        }
    }
    return false
}

function isForbiddenEntry(relativePath: string): boolean {
    return FORBIDDEN_ENTRY_PREFIXES.some(prefix => relativePath.startsWith(prefix))
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

// 以 argv 数组执行命令，避免路径含空格或 shell 元字符时被重新解析
// Run a command with an argv array so paths with spaces or shell metacharacters
// are never re-parsed.
function run(command: string, args: string[], cwd?: string) {
    const options = {
        env: {
            NO_COLOR: "1",
            ...process.env,
            npm_config_color: "false"
        },
        cwd,
        encoding: "utf-8" as const,
        stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"]
    }
    try {
        const stdout = nodeChildProcess.execFileSync(command, args, options)
        return {
            ok: true,
            output: stdout.trim()
        }
    } catch (payload: any) {
        return {
            ok: false,
            output: [payload.stdout, payload.stderr].filter(Boolean).join("\n").trim()
        }
    }
}

function check(name: string, verify: () => void) {
    try {
        verify()
        console.log(`  PASS  ${name}`)
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error)
        failures.push({ name, details })
        console.log(`  FAIL  ${name}`)
        console.log(indent(details))
    }
}

function resolveTarballPath(): string {
    const explicit = process.argv[2]
    if (explicit) {
        const resolved = nodePath.resolve(explicit)
        assert(nodeFs.existsSync(resolved), `Tarball not found: ${resolved}`)
        return resolved
    }

    const matches: string[] = []
    for (const name of nodeFs.readdirSync(process.cwd())) {
        if (TARBALL_RE.test(name)) {
            matches.push(name)
        }
    }
    matches.sort()

    const cwd = process.cwd()
    const foundList = matches.join(", ") || "(none)"
    assert(
        matches.length === 1,
        `Expected exactly one qingkuai-*.tgz in ${cwd}, found ${matches.length}: ${foundList}`
    )
    return nodePath.resolve(cwd, matches[0])
}

function listTarballEntries(tarballPath: string): string[] {
    const result = run("tar", ["-tzf", tarballPath])
    assert(result.ok, `Failed to list tarball entries:\n${result.output}`)

    const entries: string[] = []
    for (const line of result.output.split("\n")) {
        const trimmed = normalizePath(line.trim())
        if (trimmed) {
            entries.push(trimmed.replace(/^\.\//, "").replace(/\/$/, ""))
        }
    }
    return entries
}

function extractTarball(tarballPath: string, targetDir: string) {
    nodeFs.mkdirSync(targetDir, { recursive: true })

    const result = run("tar", ["-xzf", tarballPath, "-C", targetDir])
    assert(result.ok, `Failed to extract tarball:\n${result.output}`)
}

function main() {
    const tarballPath = resolveTarballPath()
    const stats = nodeFs.statSync(tarballPath)
    const repoPackage = readJson(REPO_PACKAGE_PATH)
    const entries = listTarballEntries(tarballPath)
    const tmpRoot = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "qingkuai-verify-"))
    const extractedDir = nodePath.join(tmpRoot, "extracted")
    const packageDir = nodePath.join(extractedDir, "package")
    const consumerDir = nodePath.join(tmpRoot, "consumer")
    nodeFs.mkdirSync(consumerDir, { recursive: true })

    function installFixture(name: string, targetName = name) {
        const source = nodePath.join(FIXTURE_DIR, name)
        const target = nodePath.join(consumerDir, targetName)
        nodeFs.copyFileSync(source, target)
    }

    const sizeKb = (stats.size / 1024).toFixed(1)
    const tarballName = nodePath.basename(tarballPath)
    console.log(`Verifying ${tarballName} (${sizeKb} kB, ${entries.length} entries)`)

    try {
        extractTarball(tarballPath, extractedDir)
        const packagedRelativePaths = entries.map(entry => entry.replace(/^package\//, ""))
        const packagedPackage = readJson(nodePath.join(packageDir, "package.json"))

        check("tarball contents stay inside the published allowlist", () => {
            const offenders = packagedRelativePaths.filter(entry => !isAllowedEntry(entry))
            const offenderList = offenders.map(entry => `  ${entry}`).join("\n")
            assert(!offenders.length, `Unexpected tarball entries:\n${offenderList}`)

            const forbidden = packagedRelativePaths.filter(entry => isForbiddenEntry(entry))
            const forbiddenList = forbidden.join("\n")
            assert(!forbidden.length, `Entries that must not ship:\n${forbiddenList}`)
        })

        check("package identity matches the repository", () => {
            assert(
                packagedPackage.name === repoPackage.name,
                `Packaged name ${packagedPackage.name} does not match ${repoPackage.name}`
            )
            assert(
                packagedPackage.version === repoPackage.version,
                `Packaged version ${packagedPackage.version} does not match ${repoPackage.version}`
            )
        })

        check("install-time lifecycle scripts are stripped", () => {
            const present: string[] = []
            for (const name of INSTALL_TIME_SCRIPTS) {
                if (packagedPackage.scripts?.[name] !== undefined) {
                    present.push(name)
                }
            }
            const message = `Install-time lifecycle scripts would run: ${present.join(", ")}`
            assert(!present.length, message)
        })

        // 检查发布物 README 中的 banner 图片地址
        // Check the banner image URLs in the published README
        check("packaged README references no relative images", () => {
            const readme = readSync(nodePath.join(packageDir, "README.md"))
            const htmlImages = [...readme.matchAll(/<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
            const markdownImages = [...readme.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)]
            const references: string[] = []
            for (const match of htmlImages.concat(markdownImages)) {
                references.push(match[1])
            }

            const relative = references.filter(reference => !/^https?:\/\//i.test(reference))
            const relativeList = relative.map(reference => `  ${reference}`).join("\n")
            const message = `Relative image URLs resolve against the default branch HEAD:\n${relativeList}`
            assert(!relative.length, message)
        })

        check("every exports target exists in the package", () => {
            const missing: string[] = []
            const exportsField = packagedPackage.exports ?? {}
            for (const [subpath, target] of Object.entries(exportsField)) {
                if (typeof target === "string") {
                    if (!nodeFs.existsSync(nodePath.join(packageDir, target))) {
                        missing.push(`${subpath} -> ${target}`)
                    }
                    continue
                }
                for (const [condition, file] of Object.entries(target as Record<string, string>)) {
                    if (!nodeFs.existsSync(nodePath.join(packageDir, file))) {
                        missing.push(`${subpath} [${condition}] -> ${file}`)
                    }
                }
            }

            assert(missing.length === 0, `Missing exports targets:\n${missing.join("\n")}`)
        })

        // internal 包刻意不导出类型声明以防止用户误用
        // The internal subpath deliberately ships no types to prevent misuse
        check("./internal stays untyped on purpose", () => {
            const internalEntry: Record<string, string> =
                packagedPackage.exports?.["./internal"] ?? {}
            assert(
                internalEntry.types === undefined,
                'exports["./internal"] declares a "types" condition; that subpath is deliberately untyped'
            )
        })

        check(INSTALL_CHECK, () => {
            const consumerPackage = {
                name: "qingkuai-verify-consumer",
                private: true,
                version: "0.0.0"
            }
            writeJson(nodePath.join(consumerDir, "package.json"), consumerPackage)

            const result = run(NPM, ["install", tarballPath, ...NPM_INSTALL_FLAGS], consumerDir)
            assert(result.ok, `npm install failed:\n${result.output}`)

            const installedDir = nodePath.join(consumerDir, "node_modules", "qingkuai")
            assert(nodeFs.existsSync(installedDir), `npm install did not create ${installedDir}`)
        })

        // 安装失败时入口与类型检查只会重复同一个根因，跳过以保留可读的诊断
        // When the install itself fails, the entry and type checks only repeat the
        // same root cause, so skip them to keep the diagnosis readable.
        if (failures.some(failure => failure.name === INSTALL_CHECK)) {
            console.log("  SKIP  entry and type checks (the tarball did not install)")
        } else {
            for (const runtimeCheck of RUNTIME_CHECKS) {
                check(runtimeCheck.name, () => {
                    installFixture(runtimeCheck.fixture)
                    const result = run("node", [runtimeCheck.fixture], consumerDir)
                    assert(result.ok, `Entry check failed:\n${result.output}`)
                    console.log(indent(result.output))
                })
            }

            check("type declarations are consumable", () => {
                const PROBE_FILE = "probe.ts"
                const PROBE_CONFIG = "tsconfig.probe.json"
                installFixture("type-probe.ts", PROBE_FILE)

                const probeTsconfig = {
                    compilerOptions: {
                        target: "ESNext",
                        module: "ESNext",
                        types: [],
                        strict: true,
                        noEmit: true,
                        skipLibCheck: false,
                        moduleResolution: "Bundler"
                    },
                    include: [PROBE_FILE]
                }
                writeJson(nodePath.join(consumerDir, PROBE_CONFIG), probeTsconfig)

                // 用 qingkuai 依赖的 tsc 版本来编译 probe.ts，确保类型声明可被消费者编译
                // Compile probe.ts with the tsc version that qingkuai depends on to ensure
                // that the type declarations can be compiled by consumers.
                const resolveTsc = "console.log(require.resolve('typescript/bin/tsc'))"
                const resolvedTsc = run("node", ["-e", resolveTsc], consumerDir)
                assert(resolvedTsc.ok, `Cannot resolve the consumer's tsc:\n${resolvedTsc.output}`)

                const configPath = nodePath.join(consumerDir, PROBE_CONFIG)
                const result = run("node", [resolvedTsc.output, "-p", configPath], consumerDir)
                assert(result.ok, `Type declarations are not consumable:\n${result.output}`)
            })
        }
    } finally {
        nodeFs.rmSync(tmpRoot, { recursive: true, force: true })
    }

    if (failures.length) {
        console.error(`\nPackage verification failed (${failures.length} check(s)):`)
        for (const failure of failures) {
            console.error(`  - ${failure.name}`)
        }
        process.exitCode = 1
        return
    }

    console.log("\nPackage verification passed.")
}

try {
    main()
} catch (error) {
    console.error(
        `\nPackage verification could not run: ${
            error instanceof Error ? error.message : String(error)
        }`
    )
    process.exitCode = 1
}
