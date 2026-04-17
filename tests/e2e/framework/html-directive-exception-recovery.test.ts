import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let htmlOptions = {}
            let rawHtml = '<span id="html-safe">Safe html</span>'

            const setBrokenOptions = () => {
                htmlOptions = {
                    escapeTags: "broken",
                    escapeStyle: true
                }
            }

            const setSafeOptions = () => {
                htmlOptions = {
                    escapeTags: ["style"]
                }
            }

            const setUpdatedHtml = () => {
                rawHtml = '<span id="html-updated">Updated html</span>'
            }
        </lang-js>

        <section data-page="html-directive-exception-recovery">
            <h1 id="html-title">Html directive exception recovery</h1>
            <button id="set-broken-options" @click={setBrokenOptions}>Set broken options</button>
            <button id="set-safe-options" @click={setSafeOptions}>Set safe options</button>
            <button id="set-updated-html" @click={setUpdatedHtml}>Set updated html</button>
            <div id="html-host" #html={htmlOptions}>{rawHtml}</div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("captures runtime error when html options shape is invalid", async ({
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
        await page.locator("#set-broken-options").click()

        await expect
            .poll(() => [pageErrors.join("\n"), errorLogs.join("\n")].join("\n"))
            .toMatch(/push is not a function|escapeTags\.push/)
    })

    test("keeps previous html subtree after invalid options interruption", async ({
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

        await page.locator("#set-broken-options").click()
        await expect
            .poll(() => [pageErrors.join("\n"), errorLogs.join("\n")].join("\n"))
            .toMatch(/push is not a function|escapeTags\.push/)

        await page.locator("#set-safe-options").click()
        await page.locator("#set-updated-html").click()
        await expect(page.locator("#html-host #html-updated")).toHaveCount(0)
        await expect(page.locator("#html-host #html-safe")).toHaveText("Safe html")
    })
})
