import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const createDuplicateKey = () => {
                items = [
                    { id: 1, label: "Alpha" },
                    { id: 1, label: "Duplicated" }
                ]
            }

            const createStringifiedDuplicateKey = () => {
                items = [
                    { id: 1, label: "Number one" },
                    { id: "1", label: "String one" }
                ]
            }
        </lang-js>

        <section data-page="for-directive-key-duplicate-error">
            <button
                id="create-duplicate-key"
                @click={createDuplicateKey}
            >
                Create duplicate key
            </button>
            <button
                id="create-stringified-duplicate-key"
                @click={createStringifiedDuplicateKey}
            >
                Create stringified duplicate key
            </button>
            <ul id="duplicate-key-list">
                <li
                    class="duplicate-key-item"
                    #for={item of items}
                    #key={item.id}
                >
                    {item.label}
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("throws runtime error when keyed for receives duplicate key values", async ({
        page,
        visitScenario
    }) => {
        const pageErrors: string[] = []
        page.on("pageerror", error => {
            pageErrors.push(error.message)
        })

        await visitScenario(scenario)
        await page.locator("#create-duplicate-key").click()

        await expect
            .poll(() => pageErrors.join("\n"))
            .toContain('Duplicate value for "#key" directive')
    })

    test("throws runtime error when keyed for keys collide after string conversion", async ({
        page,
        visitScenario
    }) => {
        const pageErrors: string[] = []
        page.on("pageerror", error => {
            pageErrors.push(error.message)
        })

        await visitScenario(scenario)
        await page.locator("#create-stringified-duplicate-key").click()

        await expect
            .poll(() => pageErrors.join("\n"))
            .toContain('Duplicate value for "#key" directive')
    })
})
