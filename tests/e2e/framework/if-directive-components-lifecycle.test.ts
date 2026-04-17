import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import TogglePanel from "./components/TogglePanel"

            let showComponent = false
            let lifecycleLog = ""

            const appendLog = label => {
                lifecycleLog = lifecycleLog ? lifecycleLog + "," + label : label
            }

            const toggle = () => {
                showComponent = !showComponent
            }
        </lang-js>

        <section data-page="if-directive-components-lifecycle">
            <h1 id="if-title">If component lifecycle</h1>
            <p id="lifecycle-log">{lifecycleLog}</p>
            <button id="toggle-component" @click={toggle}>Toggle component</button>

            <div id="component-host">
                <TogglePanel
                    #if={showComponent}
                    @log={appendLog}
                />
                <p
                    #else
                    id="component-fallback"
                >
                    Component fallback
                </p>
            </div>
        </section>
    `,
    components: {
        TogglePanel: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("after-mount")
                })

                onBeforeDestroy(() => {
                    props.log("before-destroy")
                })

                onAfterDestroy(() => {
                    props.log("after-destroy")
                })
            </lang-js>

            <div id="component-content">Component content</div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("logs component lifecycle when if branch mounts and unmounts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const log = page.locator("#lifecycle-log")

        await expect(page.locator("#component-fallback")).toHaveText("Component fallback")
        await expect(log).toHaveText("")

        await page.locator("#toggle-component").click()
        await expect(page.locator("#component-content")).toHaveText("Component content")
        await expect(log).toHaveText("after-mount")

        await page.locator("#toggle-component").click()
        await expect(page.locator("#component-fallback")).toHaveText("Component fallback")
        await expect(log).toHaveText("after-mount,before-destroy,after-destroy")
    })

    test("keeps component and fallback mutually exclusive through repeated toggles", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        for (let i = 0; i < 3; i++) {
            await page.locator("#toggle-component").click()
            await expect(page.locator("#component-content")).toHaveCount(1)
            await expect(page.locator("#component-fallback")).toHaveCount(0)

            await page.locator("#toggle-component").click()
            await expect(page.locator("#component-content")).toHaveCount(0)
            await expect(page.locator("#component-fallback")).toHaveCount(1)
        }
    })
})
