import nodeChildProcess from "node:child_process"
import nodeFs from "node:fs"

const MAIN_BRANCH = "main"
const VERSION_RE = /^\d+\.\d+\.\d+$/

main()

// 执行命令并返回去首尾空白的 stdout（用于读取输出）
// Run a command and return the trimmed stdout (for reading output).
function run(command: string): string {
    return nodeChildProcess
        .execSync(command, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        })
        .trim()
}

// 执行命令并将输出透传给终端（用于 git 交互类命令）
// Run a command and pass its output through to the terminal (for git commands).
function runVisible(command: string) {
    nodeChildProcess.execSync(command, { stdio: "inherit" })
}

function getCurrentBranch(): string {
    return run("git branch --show-current")
}

// 检查工作区是否存在未提交的改动
// Ensure the working tree has no uncommitted changes.
function ensureCleanWorkingTree() {
    const status = run("git status --porcelain")
    if (status) {
        throw new Error(
            `The working tree has uncommitted changes. Please commit or stash them before releasing:\n${status}`
        )
    }
}

function switchBranch(branch: string) {
    runVisible(`git checkout ${branch}`)
}

function readPackageVersion(): string {
    const packageJson = JSON.parse(nodeFs.readFileSync("package.json", "utf8"))
    const version = packageJson.version?.trim()
    if (!version) {
        throw new Error('The "version" field is missing in package.json')
    }
    return version
}

// 将版本号最后一位 +1，如 1.0.83 → 1.0.84
// Bump the last segment of the version, e.g. 1.0.83 → 1.0.84.
function bumpVersion(version: string): string {
    const segments = version.split(".")
    const lastSegment = Number(segments[segments.length - 1])
    if (!Number.isInteger(lastSegment)) {
        throw new Error(`Cannot bump version: ${version}`)
    }
    segments[segments.length - 1] = String(lastSegment + 1)
    return segments.join(".")
}

// 从命令行参数中解析显式指定的版本号（npm run release 1.0.66）
// Resolve an explicitly specified version from command-line arguments.
function resolveVersionArg(): string | undefined {
    return process.argv.slice(2).find(arg => VERSION_RE.test(arg))
}

function writePackageVersion(version: string) {
    const packageJsonPath = "package.json"
    const packageJson = JSON.parse(nodeFs.readFileSync(packageJsonPath, "utf8"))
    packageJson.version = version
    nodeFs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function main() {
    const originalBranch = getCurrentBranch()
    if (!originalBranch) {
        throw new Error(
            "You are in a detached HEAD state. Please switch to a branch before releasing"
        )
    }

    try {
        ensureCleanWorkingTree()

        const currentBranch = getCurrentBranch()
        if (currentBranch !== MAIN_BRANCH) {
            console.log(`Current branch is ${currentBranch}, switching to ${MAIN_BRANCH}...`)
            switchBranch(MAIN_BRANCH)
        }

        const version = resolveVersionArg() ?? bumpVersion(readPackageVersion())
        if (!VERSION_RE.test(version)) {
            throw new Error(`Invalid version: ${version} (expected x.y.z format)`)
        }

        writePackageVersion(version)
        console.log(`Version bumped to ${version}`)
        runVisible("git add package.json")
        runVisible(`git commit -m "release: bump version to ${version}"`)

        const tag = `v${version}`
        runVisible(`git tag ${tag}`)
        runVisible(`git push origin ${MAIN_BRANCH}`)
        runVisible(`git push origin ${tag}`)
        console.log(`Pushed tag ${tag} to trigger the release workflow`)
    } finally {
        const currentBranch = getCurrentBranch()
        if (currentBranch && currentBranch !== originalBranch) {
            console.log(`Switching back to ${originalBranch}...`)
            switchBranch(originalBranch)
        }
    }
}
