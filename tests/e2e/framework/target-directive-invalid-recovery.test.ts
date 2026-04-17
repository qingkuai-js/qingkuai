import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let targetSelector = null

            const setInvalidTarget = () => {
                targetSelector = true
            }

            const setTargetA = () => {
                targetSelector = "#target-dest-a"
            }

            const resetInline = () => {
                targetSelector = null
            }
        </lang-js>

        <section data-page="target-directive-invalid-recovery">
            <h1 id="target-title">Target directive invalid recovery</h1>
            <button id="set-invalid-target" @click={setInvalidTarget}>Set invalid target</button>
            <button id="set-target-a" @click={setTargetA}>Set target A</button>
            <button id="reset-inline" @click={resetInline}>Reset inline</button>

            <div id="target-source-container">
                <div #target={targetSelector}>
                    <p id="target-content">Target payload</p>
                </div>
            </div>
            <div id="target-dest-a"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("throws runtime error when target value is not an Element-like target", async ({
        page,
        visitScenario
    }) => {
        const pageErrors: string[] = []
        const errorLogs: string[] = []

        page.on("pageerror", error => {
            pageErrors.push(error.message)
        })
        page.on("console", message => {
            if (message.type() === "error") {
                errorLogs.push(message.text())
            }
        })

        await visitScenario(scenario)
        await page.locator("#set-invalid-target").click()

        await expect
            .poll(() => [pageErrors.join("\n"), errorLogs.join("\n")].join("\n"))
            .toContain("Invalid Element node")
    })

    test("keeps target content in previous state after invalid target interruption", async ({
        page,
        visitScenario
    }) => {
        const pageErrors: string[] = []
        const errorLogs: string[] = []

        page.on("pageerror", error => {
            pageErrors.push(error.message)
        })
        page.on("console", message => {
            if (message.type() === "error") {
                errorLogs.push(message.text())
            }
        })

        await visitScenario(scenario)

        await page.locator("#set-invalid-target").click()
        await expect
            .poll(() => [pageErrors.join("\n"), errorLogs.join("\n")].join("\n"))
            .toContain("Invalid Element node")

        await page.locator("#set-target-a").click()
        await expect(page.locator("#target-dest-a #target-content")).toHaveCount(0)
        await expect(page.locator("#target-source-container #target-content")).toHaveText(
            "Target payload"
        )

        await page.locator("#reset-inline").click()
        await expect(page.locator("#target-source-container #target-content")).toHaveText(
            "Target payload"
        )
    })
})
