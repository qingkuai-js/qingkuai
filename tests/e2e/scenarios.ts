import type { E2EScenarioTestModule } from "#type-declarations/testing"
import type { E2EScenario, E2EScenarioName } from "#type-declarations/testing"

import nodeFs from "node:fs"
import nodePath from "node:path"
import nodeUrl from "node:url"

const E2E_ROOT_DIR = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))

export const e2eScenarioModules = await loadScenarioModules()

export const e2eScenarios = e2eScenarioModules.map(item => item.scenario) satisfies E2EScenario[]

export function getE2EScenario(name: string) {
    const scenario = e2eScenarios.find(item => item.name === name)
    if (!scenario) {
        throw new Error(`Unknown E2E scenario: ${name}`)
    }
    return scenario
}

export function isE2EScenarioName(value: string): value is E2EScenarioName {
    return e2eScenarios.some(item => item.name === value)
}

async function loadScenarioModules() {
    const filePaths = collectScenarioTestFiles(E2E_ROOT_DIR)
    const modules = await Promise.all(
        filePaths.map(async filePath => {
            const moduleUrl = new URL(`${nodeUrl.pathToFileURL(filePath).href}?registry=1`).href
            return (await import(moduleUrl)).default as E2EScenarioTestModule
        })
    )

    assertUniqueScenarioNames(modules)
    return modules
}

function collectScenarioTestFiles(rootDir: string) {
    const groupDirs = ["framework", "apps", "issues"]
    const results: string[] = []

    for (const groupDir of groupDirs) {
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

function assertUniqueScenarioNames(modules: E2EScenarioTestModule[]) {
    const names = new Set<string>()
    for (const module of modules) {
        const name = module.scenario.name
        if (names.has(name)) {
            throw new Error(`Duplicated E2E scenario name: ${name}`)
        }
        names.add(name)
    }
}
