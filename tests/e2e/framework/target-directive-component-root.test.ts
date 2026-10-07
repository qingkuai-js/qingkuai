import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import PortalBox from "./components/PortalBox"

            let dest = null

            const moveToA = () => {
                dest = "#portal-dest-a"
            }

            const resetInline = () => {
                dest = null
            }
        </lang-js>

        <section data-page="target-directive-component-root">
            <div>
                <button id="portal-to-a" @click={moveToA}>to A</button>
                <button id="portal-reset" @click={resetInline}>reset</button>
            </div>
            <div id="portal-dest-a"></div>
            <div id="portal-source">
                <PortalBox #target={dest} note="portal-note" />
            </div>
        </section>
    `,
    components: {
        PortalBox: `
            <article class="portal-main">
                <p class="portal-body">portal body</p>
            </article>
            <span class="portal-note" #if={props.note}>{props.note}</span>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keeps component roots inline while the target is unset", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#portal-source .portal-main")).toHaveCount(1)
        await expect(page.locator("#portal-source .portal-note")).toHaveCount(1)
        await expect(page.locator("#portal-dest-a .portal-main")).toHaveCount(0)
        await expect(page.locator("#portal-dest-a .portal-note")).toHaveCount(0)
    })

    test("moves every root of the component into the target element", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#portal-to-a").click()

        await expect(page.locator("#portal-dest-a .portal-main")).toHaveCount(1)
        await expect(page.locator("#portal-dest-a .portal-note")).toHaveCount(1)
        await expect(page.locator("#portal-source .portal-main")).toHaveCount(0)
        await expect(page.locator("#portal-source .portal-note")).toHaveCount(0)
    })

    test("moves component roots back inline when the target is unset", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#portal-to-a").click()
        await expect(page.locator("#portal-dest-a .portal-main")).toHaveCount(1)

        await page.locator("#portal-reset").click()

        await expect(page.locator("#portal-source .portal-main")).toHaveCount(1)
        await expect(page.locator("#portal-source .portal-note")).toHaveCount(1)
        await expect(page.locator("#portal-dest-a .portal-main")).toHaveCount(0)
        await expect(page.locator("#portal-dest-a .portal-note")).toHaveCount(0)
    })
})
