import nodeFs from "node:fs"
import nodeChildProcess from "node:child_process"

// 读取 utf-8 编码的文本文件
// Read a text file with utf-8 encoding.
export function readSync(filePath: string): string {
    return nodeFs.readFileSync(filePath, "utf-8")
}

// 执行命令并返回去首尾空白的 stdout（用于读取输出）
// Run a command and return the trimmed stdout (for reading output).
export function run(command: string): string {
    return nodeChildProcess
        .execSync(command, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        })
        .trim()
}

// 执行命令并将输出透传给终端（用于 git 交互类命令）
// Run a command and pass its output through to the terminal (for git commands).
export function runVisible(command: string) {
    nodeChildProcess.execSync(command, { stdio: "inherit" })
}

// 将字符串中的正则特殊字符转义
// Escape regex special characters in a string.
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// 读取 package.json 中的版本号，缺失时抛出错误
// Read the version from package.json, throwing when it is missing.
export function readPackageVersion(): string {
    const packageJson = JSON.parse(nodeFs.readFileSync("package.json", "utf8"))
    const version = packageJson.version?.trim()
    if (!version) {
        throw new Error('The "version" field is missing in package.json')
    }
    return version
}

// 构造匹配 CHANGELOG 中指定版本段落标题（如 `## [1.0.91]`）的正则
// Build a regex matching the changelog section heading of a version (e.g. `## [1.0.91]`).
export function changelogSectionHeadingRE(version: string, flags?: string): RegExp {
    return new RegExp(`^## \\[${escapeRegExp(version)}\\]`, flags)
}
