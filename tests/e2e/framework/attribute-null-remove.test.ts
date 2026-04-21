import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let dataValue = "init-data"
            let titleValue = "init-title"

            const setNull = () => {
                dataValue = null
                titleValue = null
            }

            const setUndefined = () => {
                dataValue = undefined
                titleValue = undefined
            }
        </lang-js>

        <section data-page="attribute-null-remove">
            <div id="target" !data-note={dataValue} !title={titleValue}>target</div>

            <button id="set-null" @click={setNull}>Set null</button>
            <button id="set-undefined" @click={setUndefined}>Set undefined</button>

            <p id="state-data">Data: {dataValue}</p>
            <p id="state-title">Title: {titleValue}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("removes normal attributes when bound values become null or undefined", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target")).toHaveAttribute("data-note", "init-data")
        await expect(page.locator("#target")).toHaveAttribute("title", "init-title")

        await page.locator("#set-null").click()
        await expect(page.locator("#state-data")).toHaveText("Data: null")
        await expect(page.locator("#state-title")).toHaveText("Title: null")
        await expect(page.locator("#target")).not.toHaveAttribute("data-note", /.+/)
        await expect(page.locator("#target")).not.toHaveAttribute("title", /.+/)

        await page.locator("#set-undefined").click()
        await expect(page.locator("#state-data")).toHaveText("Data: undefined")
        await expect(page.locator("#state-title")).toHaveText("Title: undefined")
        await expect(page.locator("#target")).not.toHaveAttribute("data-note", /.+/)
        await expect(page.locator("#target")).not.toHaveAttribute("title", /.+/)
    })
})
