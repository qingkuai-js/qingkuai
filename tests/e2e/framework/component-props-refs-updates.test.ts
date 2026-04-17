import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import FormPanel from "./components/ui/FormPanel"

            let cardTitle = "Initial title"
            let cardCount = 1
            let model = 5

            const updateProps = () => {
                cardTitle = "Updated title"
                cardCount = 3
            }

            const increaseParentModel = () => {
                model++
            }
        </lang-js>

        <section data-page="component-props-refs-updates">
            <h1 id="component-props-refs-title">Component Props And Refs</h1>
            <p id="parent-model">Parent model: {model}</p>

            <button id="update-props" @click={updateProps}>Update props</button>
            <button id="increase-parent-model" @click={increaseParentModel}>Increase parent model</button>

            <FormPanel
                !title={cardTitle}
                !count={cardCount}
                &model={model}
            />

            <FormPanel !title={"Second card"} />
        </section>
    `,
    components: {
        "ui/FormPanel": `
            <lang-js>
                defaultProps({
                    count: 0,
                    featured: false
                })

                defaultRefs({
                    model: 10,
                    localSeed: 10
                })

                const bumpModel = () => {
                    refs.model++
                }

                const bumpLocalSeed = () => {
                    refs.localSeed++
                }
            </lang-js>

            <article class="form-panel">
                <h3 class="panel-title">{props.title}</h3>
                <p class="panel-count">Count: {props.count}</p>
                <p class="panel-featured">Featured: {props.featured ? "yes" : "no"}</p>
                <p class="panel-model">Model: {refs.model}</p>
                <p class="panel-local-seed">Local seed: {refs.localSeed}</p>
                <button class="panel-bump" @click={bumpModel}>Bump model</button>
                <button class="panel-bump-local" @click={bumpLocalSeed}>Bump local</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports props refs updates and default values", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const panels = page.locator(".form-panel")

        await expect(panels.nth(0).locator(".panel-title")).toHaveText("Initial title")
        await expect(panels.nth(0).locator(".panel-count")).toHaveText("Count: 1")
        await expect(panels.nth(0).locator(".panel-featured")).toHaveText("Featured: no")
        await expect(panels.nth(0).locator(".panel-model")).toHaveText("Model: 5")
        await expect(panels.nth(0).locator(".panel-local-seed")).toHaveText("Local seed: 10")

        await expect(panels.nth(1).locator(".panel-title")).toHaveText("Second card")
        await expect(panels.nth(1).locator(".panel-count")).toHaveText("Count: 0")
        await expect(panels.nth(1).locator(".panel-featured")).toHaveText("Featured: no")
        await expect(panels.nth(1).locator(".panel-model")).toHaveText("Model: 10")
        await expect(panels.nth(1).locator(".panel-local-seed")).toHaveText("Local seed: 10")

        await page.locator("#update-props").click()
        await expect(panels.nth(0).locator(".panel-title")).toHaveText("Updated title")
        await expect(panels.nth(0).locator(".panel-count")).toHaveText("Count: 3")

        await panels.nth(0).locator(".panel-bump").click()
        await expect(page.locator("#parent-model")).toHaveText("Parent model: 6")
        await expect(panels.nth(0).locator(".panel-model")).toHaveText("Model: 6")

        await page.locator("#increase-parent-model").click()
        await expect(page.locator("#parent-model")).toHaveText("Parent model: 7")
        await expect(panels.nth(0).locator(".panel-model")).toHaveText("Model: 7")

        await panels.nth(0).locator(".panel-bump-local").click()
        await expect(panels.nth(0).locator(".panel-local-seed")).toHaveText("Local seed: 11")
    })
})
