import nodeFs from "node:fs"
import nodePath from "node:path"

const E2E_ROOT_DIR = "tests/e2e"
const OUTPUT_PATH = "badges/e2e-scenarios.json"
const GROUP_DIRS = ["framework", "apps", "issues"]

function collectScenarioTestFiles(rootDir: string): string[] {
    const results: string[] = []
    for (const groupDir of GROUP_DIRS) {
        const absoluteDir = nodePath.join(rootDir, groupDir)
        if (!nodeFs.existsSync(absoluteDir)) {
            continue
        }
        collectRecursively(absoluteDir, results)
    }
    return results.sort((left, right) => left.localeCompare(right))
}

function collectRecursively(currentDir: string, results: string[]) {
    const entries = nodeFs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
        const absolutePath = nodePath.join(currentDir, entry.name)
        if (entry.isDirectory()) {
            collectRecursively(absolutePath, results)
            continue
        }
        if (entry.isFile() && entry.name.endsWith(".test.ts")) {
            results.push(absolutePath)
        }
    }
}

function getBadgeColor(count: number): string {
    if (count >= 120) {
        return "brightgreen"
    }
    if (count >= 80) {
        return "green"
    }
    if (count >= 40) {
        return "yellowgreen"
    }
    if (count >= 20) {
        return "yellow"
    }
    return "orange"
}

const scenarioFiles = collectScenarioTestFiles(E2E_ROOT_DIR)
const count = scenarioFiles.length
const badgeData = {
    schemaVersion: 1,
    label: "e2e scenarios",
    message: String(count),
    color: getBadgeColor(count)
}

nodeFs.mkdirSync(nodePath.dirname(OUTPUT_PATH), { recursive: true })
nodeFs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(badgeData, null, 2)}\n`)

console.log(`E2E scenarios badge generated: ${OUTPUT_PATH} -> ${badgeData.message}`)
