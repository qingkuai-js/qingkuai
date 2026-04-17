import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import LifecycleMonitor from "./components/ui/LifecycleMonitor"

            let lifecycleLog = ""
            let showComponent = false
            let version = 0

            const appendLog = label => {
                lifecycleLog = lifecycleLog ? lifecycleLog + "," + label : label
            }

            const toggle = () => {
                showComponent = !showComponent
            }

            const incrementVersion = () => {
                version++
            }
        </lang-js>

        <section data-page="component-lifecycle-hooks">
            <h1 id="lifecycle-title">Component Lifecycle Hooks</h1>
            <p id="lifecycle-log">{lifecycleLog}</p>
            <button id="toggle-btn" @click={toggle}>Toggle</button>
            <button id="update-btn" @click={incrementVersion}>Update</button>
            <LifecycleMonitor
                #if={showComponent}
                !version={version}
                @appendLog={appendLog}
            />
        </section>
    `,
    components: {
        "ui/LifecycleMonitor": `
            <lang-js>
                import { onAfterMount, onBeforeUpdate, onAfterUpdate, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.appendLog("after-mount")
                })

                onBeforeUpdate(() => {
                    props.appendLog("before-update")
                })

                onAfterUpdate(() => {
                    props.appendLog("after-update")
                })

                onBeforeDestroy(() => {
                    props.appendLog("before-destroy")
                })

                onAfterDestroy(() => {
                    props.appendLog("after-destroy")
                })
            </lang-js>

            <div id="monitor-panel">
                <p id="monitor-version">Version: {props.version}</p>
                <p id="monitor-status">Component mounted and active</p>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("component mounts when condition becomes true", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const monitor = page.locator("#monitor-panel")
        const log = page.locator("#lifecycle-log")
        await expect(monitor).toHaveCount(0)
        await expect(log).toHaveText("")

        await page.locator("#toggle-btn").click()
        await expect(monitor).toBeVisible()
        await expect(page.locator("#monitor-version")).toHaveText("Version: 0")
        await expect(page.locator("#monitor-status")).toHaveText("Component mounted and active")
        await expect(log).toHaveText("after-mount")
    })

    test("component logs beforeUpdate and afterUpdate when props change", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const log = page.locator("#lifecycle-log")

        await page.locator("#toggle-btn").click()
        await expect(page.locator("#monitor-version")).toHaveText("Version: 0")
        await expect(log).toHaveText("after-mount")

        await page.locator("#update-btn").click()
        await expect(page.locator("#monitor-version")).toHaveText("Version: 1")
        await expect(log).toHaveText("after-mount,before-update,after-update")
    })

    test("component unmounts when condition becomes false", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const monitor = page.locator("#monitor-panel")
        const log = page.locator("#lifecycle-log")

        await page.locator("#toggle-btn").click()
        await expect(monitor).toBeVisible()
        await expect(log).toHaveText("after-mount")

        await page.locator("#toggle-btn").click()
        await expect(monitor).toHaveCount(0)
        await expect(log).toHaveText("after-mount,before-destroy,after-destroy")
    })

    test("supports multiple mount/unmount cycles", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const monitor = page.locator("#monitor-panel")
        const log = page.locator("#lifecycle-log")

        for (let i = 0; i < 3; i++) {
            await page.locator("#toggle-btn").click()
            await expect(monitor).toBeVisible()

            await page.locator("#update-btn").click()
            await expect(page.locator("#monitor-version")).toHaveText(`Version: ${i + 1}`)

            await page.locator("#toggle-btn").click()
            await expect(monitor).toHaveCount(0)
        }

        await expect(log).toHaveText(
            "after-mount,before-update,after-update,before-destroy,after-destroy,after-mount,before-update,after-update,before-destroy,after-destroy,after-mount,before-update,after-update,before-destroy,after-destroy"
        )
    })
})
