import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import AliasPanel from "./components/ui/AliasPanel"

            let title = "Alpha"
            let model = 2

            const updateTitle = () => {
                title = "Beta"
            }

            const increaseParentModel = () => {
                model++
            }
        </lang-js>

        <section data-page="component-attribute-alias">
            <p id="parent-model">Parent model: {model}</p>
            <button id="update-title" @click={updateTitle}>Update title</button>
            <button id="increase-parent-model" @click={increaseParentModel}>Increase parent model</button>

            <AliasPanel !title &model={model} />
        </section>
    `,
    components: {
        "ui/AliasPanel": `
            <lang-js>
                const { title } = alias(props)
                let { model } = alias(refs)

                const increaseFromChild = () => {
                    model++
                }
            </lang-js>

            <article id="alias-panel">
                <p id="alias-title">{title}</p>
                <p id="alias-model">{model}</p>
                <button id="alias-child-increase" @click={increaseFromChild}>Increase from child</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports alias(props) reactive destructuring", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#alias-title")).toHaveText("Alpha")
        await page.locator("#update-title").click()
        await expect(page.locator("#alias-title")).toHaveText("Beta")
    })

    test("supports alias(refs) reactive destructuring", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#parent-model")).toHaveText("Parent model: 2")
        await expect(page.locator("#alias-model")).toHaveText("2")

        await page.locator("#alias-child-increase").click()
        await expect(page.locator("#parent-model")).toHaveText("Parent model: 3")
        await expect(page.locator("#alias-model")).toHaveText("3")

        await page.locator("#increase-parent-model").click()
        await expect(page.locator("#parent-model")).toHaveText("Parent model: 4")
        await expect(page.locator("#alias-model")).toHaveText("4")
    })
})
