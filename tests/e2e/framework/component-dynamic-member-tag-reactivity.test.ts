import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ProfileView from "./components/ui/ProfileView"
            import StatsView from "./components/ui/StatsView"

            const registry = {
                active: ProfileView
            }
            let parentCount = 0

            const switchMemberView = () => {
                registry.active = registry.active === ProfileView ? StatsView : ProfileView
            }

            const increaseParentCount = () => {
                parentCount++
            }
        </lang-js>

        <section data-page="component-dynamic-member-tag-reactivity">
            <h1 id="dynamic-member-title">Dynamic Member Component Tag Reactivity</h1>
            <p id="parent-count">Parent count: {parentCount}</p>

            <button id="switch-member" @click={switchMemberView}>Switch member view</button>
            <button id="increase-parent" @click={increaseParentCount}>Increase parent count</button>

            <registry.active id="member-view" !count={parentCount} />
        </section>
    `,
    components: {
        "ui/ProfileView": `
            <article id="profile-view" !data-root={props.id}>
                <p class="name">Profile</p>
                <p class="count">Count: {props.count}</p>
            </article>
        `,
        "ui/StatsView": `
            <article id="stats-view" !data-root={props.id}>
                <p class="name">Stats</p>
                <p class="count">Count: {props.count}</p>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("updates member-expression component tag when host object property changes", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#profile-view")).toBeVisible()
        await expect(page.locator("#stats-view")).toHaveCount(0)

        await page.locator("#switch-member").click()
        await expect(page.locator("#stats-view")).toBeVisible()
        await expect(page.locator("#profile-view")).toHaveCount(0)

        await page.locator("#increase-parent").click()
        await expect(page.locator("#parent-count")).toHaveText("Parent count: 1")
        await expect(page.locator("#stats-view .count")).toHaveText("Count: 1")

        await page.locator("#switch-member").click()
        await expect(page.locator("#profile-view")).toBeVisible()
        await expect(page.locator("#stats-view")).toHaveCount(0)
        await expect(page.locator("#profile-view .count")).toHaveText("Count: 1")
    })
})
