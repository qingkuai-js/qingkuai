import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})
            let htmlPromise = createPendingPromise()

            const resetAwait = () => {
                htmlPromise = createPendingPromise()
            }

            const resolveAwait = () => {
                htmlPromise = new Promise(resolve => {
                    setTimeout(() => resolve('<strong id="html-await-then-inner">Then html</strong>'), 10)
                })
            }

            const rejectAwait = () => {
                htmlPromise = new Promise((_, reject) => {
                    setTimeout(() => reject('<strong id="html-await-catch-inner">Catch html</strong>'), 10)
                })
            }
        </lang-js>

        <section data-page="html-directive-await">
            <h1 id="html-title">Html directive</h1>
            <div>
                <button id="html-await-reset" @click={resetAwait}>Await reset</button>
                <button id="html-await-resolve" @click={resolveAwait}>Await resolve</button>
                <button id="html-await-reject" @click={rejectAwait}>Await reject</button>
            </div>
            <div id="html-await-host">
                <div id="html-await-pending" #await={htmlPromise} #html>
                    {'<span id="html-await-pending-inner">Pending html</span>'}
                </div>
                <div id="html-await-then" #then={value} #html>{value}</div>
                <div id="html-await-catch" #catch={err} #html>{err}</div>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports html directive combined with await branches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-await-host #html-await-pending-inner")).toHaveText(
            "Pending html"
        )
        await expect(page.locator("#html-await-host #html-await-then-inner")).toHaveCount(0)
        await expect(page.locator("#html-await-host #html-await-catch-inner")).toHaveCount(0)

        await page.locator("#html-await-resolve").click()
        await expect(page.locator("#html-await-host #html-await-then-inner")).toHaveText(
            "Then html"
        )

        await page.locator("#html-await-reset").click()
        await expect(page.locator("#html-await-host #html-await-pending-inner")).toHaveText(
            "Pending html"
        )

        await page.locator("#html-await-reject").click()
        await expect(page.locator("#html-await-host #html-await-catch-inner")).toHaveText(
            "Catch html"
        )
    })
})
