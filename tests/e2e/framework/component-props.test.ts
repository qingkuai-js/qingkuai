import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import PropCard from "./components/layout/PropCard"

            const cardTitle = "Initial title"
            const cardCount = 1
        </lang-js>

        <section data-page="component-props">
            <h1 id="component-props-title">Component Props</h1>

            <PropCard
                !title={cardTitle}
                !count={cardCount}
            />

            <PropCard
                !title={"Second card"}
            />
        </section>
    `,
    components: {
        "layout/PropCard": `
            <lang-js>
                defaultProps({
                    count: 0,
                    featured: false
                })
            </lang-js>

            <article id="prop-card">
                <h3 id="prop-card-title">{props.title}</h3>
                <p id="prop-card-count">Count: {props.count}</p>
                <p id="prop-card-featured">Featured: {props.featured ? "yes" : "no"}</p>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test.describe("component props case", () => {
        test("supports component props passing", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page).toHaveTitle("component-props")
            await expect(page.locator("#component-props-title")).toHaveText("Component Props")

            const cards = page.locator("#prop-card")

            await expect(cards.nth(0).locator("#prop-card-title")).toHaveText("Initial title")
            await expect(cards.nth(0).locator("#prop-card-count")).toHaveText("Count: 1")
            await expect(cards.nth(0).locator("#prop-card-featured")).toHaveText("Featured: no")

            await expect(cards.nth(1).locator("#prop-card-title")).toHaveText("Second card")
            await expect(cards.nth(1).locator("#prop-card-count")).toHaveText("Count: 0")
            await expect(cards.nth(1).locator("#prop-card-featured")).toHaveText("Featured: no")
        })
    })
})
