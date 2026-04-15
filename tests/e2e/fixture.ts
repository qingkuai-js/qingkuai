import type {
    E2EScenario,
    E2EFixtures,
    E2ECompileMode,
    E2EScenarioInput,
    E2EWorkerFixtures,
    E2EProjectMetadata
} from "#type-declarations/testing"

import nodeProcess from "node:process"
import nodeChildProcess from "node:child_process"

import { test as baseTest, expect } from "@playwright/test"

const SERVER_BOOT_TIMEOUT_MS = 10000
const SERVER_HEALTH_INTERVAL_MS = 150

export const test = baseTest.extend<E2EFixtures, E2EWorkerFixtures>({
    serverOrigin: [
        async ({ browserName }, use, workerInfo) => {
            const compileMode = getProjectCompileMode(workerInfo.project.metadata)
            const projectBrowserName = getProjectBrowserName(workerInfo.project.name, browserName)
            const port = getWorkerPort(projectBrowserName, compileMode, workerInfo.workerIndex)
            const serverOrigin = `http://127.0.0.1:${port}`
            const serverProcess = nodeChildProcess.spawn(
                "pnpm",
                ["exec", "tsx", "tests/e2e/server.ts"],
                {
                    env: {
                        ...nodeProcess.env,
                        COMPILE_MODE: compileMode,
                        PLAYWRIGHT_PORT: String(port)
                    },
                    cwd: nodeProcess.cwd(),
                    stdio: ["ignore", "pipe", "pipe"]
                }
            )

            const outputChunks: string[] = []
            serverProcess.stdout.on("data", chunk => outputChunks.push(String(chunk)))
            serverProcess.stderr.on("data", chunk => outputChunks.push(String(chunk)))

            try {
                await waitForServer(`${serverOrigin}/__health`, serverProcess, outputChunks)
                await use(serverOrigin)
            } finally {
                await stopServerProcess(serverProcess)
            }
        },
        { scope: "worker" }
    ],
    visitScenario: async ({ page, serverOrigin }, use) => {
        await use(async (scenario: E2EScenarioInput) => {
            const name = (scenario as E2EScenario).name
            await page.goto(`${serverOrigin}/scenarios/${name}`)
            await expect(page.locator("body")).toHaveAttribute("data-e2e-ready", "ready")
            await expect(page.locator(`[data-page='${name}']`)).toBeVisible()
        })
    }
})

function getProjectCompileMode(metadata: unknown): E2ECompileMode {
    if (
        metadata &&
        typeof metadata === "object" &&
        "compileMode" in metadata &&
        (metadata as E2EProjectMetadata).compileMode === "non-debug"
    ) {
        return "non-debug"
    }
    return "debug"
}

function getWorkerPort(browserName: string, compileMode: E2ECompileMode, workerIndex: number) {
    const browserOffset =
        browserName === "chromium"
            ? 0
            : browserName === "firefox"
              ? 100
              : browserName === "webkit"
                ? 200
                : 300
    const compileModeOffset = compileMode === "non-debug" ? 1000 : 0
    return 34173 + browserOffset + compileModeOffset + workerIndex
}

function getProjectBrowserName(projectName: string, browserName: string) {
    const [projectBrowserName] = projectName.split("-")
    return projectBrowserName || browserName
}

async function waitForServer(
    url: string,
    serverProcess: nodeChildProcess.ChildProcess,
    output: string[]
) {
    const timeoutAt = Date.now() + SERVER_BOOT_TIMEOUT_MS
    while (Date.now() < timeoutAt) {
        if (serverProcess.exitCode !== null) {
            throw new Error(`E2E server exited early.\n${output.join("")}`)
        }

        try {
            const response = await fetch(url)
            if (response.ok) {
                return
            }
        } catch {
            // Ignore connection errors until timeout.
        }

        await new Promise(resolve => setTimeout(resolve, SERVER_HEALTH_INTERVAL_MS))
    }
    await stopServerProcess(serverProcess)
    throw new Error(`Timed out waiting for E2E server.\n${output.join("")}`)
}

async function stopServerProcess(serverProcess: nodeChildProcess.ChildProcess) {
    if (serverProcess.exitCode !== null) {
        return
    }

    const waitForExit = new Promise<void>(resolve => {
        serverProcess.once("exit", () => resolve())
    })

    serverProcess.kill("SIGTERM")

    const timeout = new Promise<void>(resolve => {
        setTimeout(() => {
            if (serverProcess.exitCode === null) {
                serverProcess.kill("SIGKILL")
            }
            resolve()
        }, 2000)
    })

    await Promise.race([waitForExit, timeout])
}
