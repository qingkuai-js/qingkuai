import type { E2EScenarioInput } from "#type-declarations/testing"

import { formatSourceCode } from "../../../src/util/shared/sundry"
import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import TogglePanel from "./components/TogglePanel"
            import ToggleOrderPanel from "./components/ToggleOrderPanel"
            import IfChainIfPanel from "./components/IfChainIfPanel"
            import IfChainElifPanel from "./components/IfChainElifPanel"
            import IfChainElsePanel from "./components/IfChainElsePanel"

            let showComponent = false
            let componentBranch = "else"

            const toggleComponent = () => {
                showComponent = !showComponent
            }

            const cycleComponentBranch = () => {
                componentBranch = componentBranch === "else"
                    ? "if"
                    : componentBranch === "if"
                        ? "elif"
                        : "else"
            }
        </lang-js>

        <section data-page="if-directive-components">
            <h1 id="if-title">If directive</h1>

            <button
                id="toggle-component"
                @click={toggleComponent()}
            >
                Toggle component
            </button>
            <button
                id="cycle-component-branch"
                @click={cycleComponentBranch()}
            >
                Cycle component branch
            </button>

            <div id="component-host">
                <TogglePanel #if={showComponent} />
                <p
                    #else
                    id="component-fallback"
                >
                    Component fallback
                </p>
            </div>

            <div id="component-order-host">
                <span class="component-order-marker">Before</span>
                <ToggleOrderPanel #if={showComponent} />
                <span class="component-order-marker">After</span>
            </div>

            <div id="component-chain-host">
                <span class="component-chain-marker">Before chain</span>
                <IfChainIfPanel #if={componentBranch === "if"} />
                <IfChainElifPanel #elif={componentBranch === "elif"} />
                <IfChainElsePanel #else />
                <span class="component-chain-marker">After chain</span>
            </div>
        </section>
    `,
    components: {
        TogglePanel: formatSourceCode(`
            <div id="component-content">Component content</div>
        `),
        ToggleOrderPanel: formatSourceCode(`
            <div id="component-order-content">Component content</div>
        `),
        IfChainIfPanel: formatSourceCode(`
            <div id="component-chain-if">Component if branch</div>
        `),
        IfChainElifPanel: formatSourceCode(`
            <div id="component-chain-elif">Component elif branch</div>
        `),
        IfChainElsePanel: formatSourceCode(`
            <div id="component-chain-else">Component else branch</div>
        `)
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports if on component tags", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#component-fallback")).toHaveText("Component fallback")

        await page.locator("#toggle-component").click()
        await expect(page.locator("#component-content")).toHaveText("Component content")

        await page.locator("#toggle-component").click()
        await expect(page.locator("#component-fallback")).toHaveText("Component fallback")
    })

    test("keeps component if branch between stable siblings", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const children = page.locator("#component-order-host > *")
        await expect(children).toHaveText(["Before", "After"])

        await page.locator("#toggle-component").click()
        await expect(children).toHaveText(["Before", "Component content", "After"])

        await page.locator("#toggle-component").click()
        await expect(children).toHaveText(["Before", "After"])
    })

    test("supports full component if elif else chain switching", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#component-chain-else")).toHaveText("Component else branch")

        await page.locator("#cycle-component-branch").click()
        await expect(page.locator("#component-chain-if")).toHaveText("Component if branch")

        await page.locator("#cycle-component-branch").click()
        await expect(page.locator("#component-chain-elif")).toHaveText("Component elif branch")

        await page.locator("#cycle-component-branch").click()
        await expect(page.locator("#component-chain-else")).toHaveText("Component else branch")
    })
})
