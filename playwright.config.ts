/// <reference types="node" />

import type { ProcessEnvHost } from "./src/types/testing"

import nodeOs from "node:os"
import nodePath from "node:path"

import { defineConfig, devices } from "@playwright/test"

const env = (globalThis as ProcessEnvHost).process?.env

const isCI = !!env?.CI
const prodOnly = !!env?.PROD_ONLY
const reporter = env?.E2E_REPORTER ?? "line"
const parsedSlowMoMs = Number(env?.SLOW_MO_MS ?? "0")
const slowMoMs = Number.isFinite(parsedSlowMoMs) && parsedSlowMoMs > 0 ? parsedSlowMoMs : 0
const isHeaded =
    process.argv.includes("--headed") || env?.npm_config_headed === "true" || env?.HEADED === "1"

const browserProjects = [
    {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] }
    },
    {
        name: "edge",
        use: {
            channel: "msedge",
            ...devices["Desktop Edge"]
        }
    },
    {
        name: "firefox",
        use: { ...devices["Desktop Firefox"] }
    },
    {
        name: "webkit",
        use: { ...devices["Desktop Safari"] }
    }
]

const projects = browserProjects.flatMap(browserProject => {
    const projectModes = [
        {
            compileMode: "non-debug",
            projectSuffix: "non-debug"
        }
    ]
    if (!prodOnly) {
        projectModes.push({
            compileMode: "debug",
            projectSuffix: "debug"
        })
    }
    return projectModes.map(projectMode => ({
        metadata: {
            compileMode: projectMode.compileMode
        },
        use: browserProject.use,
        name: `${browserProject.name}-${projectMode.projectSuffix}`
    }))
})

export default defineConfig({
    reporter,
    use: {
        headless: !isHeaded,
        launchOptions: {
            slowMo: slowMoMs
        },
        trace: "on-first-retry"
    },
    projects,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    fullyParallel: !isHeaded,
    testDir: "./tests/e2e",
    testMatch: "**/*.test.ts",
    workers: isHeaded ? 1 : isCI ? 2 : undefined,
    outputDir: nodePath.join(nodeOs.tmpdir(), "qingkuai-playwright-artifacts")
})
