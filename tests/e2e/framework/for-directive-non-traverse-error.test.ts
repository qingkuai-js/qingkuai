import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let listSource = ["A", "B"]

            const setNonTraversable = () => {
                listSource = true
            }
        </lang-js>

        <section data-page="for-directive-non-traverse-error">
            <button id="set-non-traversable" @click={setNonTraversable}>Set non-traversable</button>
            <div id="non-traverse-host">
                <span
                    class="non-traverse-item"
                    #for={item of listSource}
                >
                    {item}
                </span>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("throws runtime error when for source becomes non-traversable", async ({
        page,
        visitScenario
    }) => {
        const pageErrors: string[] = []
        page.on("pageerror", error => {
            pageErrors.push(error.message)
        })

        await visitScenario(scenario)
        await expect(page.locator("#non-traverse-host .non-traverse-item")).toHaveText(["A", "B"])

        await page.locator("#set-non-traversable").click()

        await expect
            .poll(() => pageErrors.join("\n"))
            .toContain('The given value for "#for" directive is non-traversable.')
    })
})
