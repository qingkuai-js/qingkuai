import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import { getCurrentInstance, onAfterMount } from "qingkuai"
            import InstanceProbe from "./components/InstanceProbe"

            let log = ""
            let showProbe = false
            let version = 0
            let outsideProbe = "none"

            const appendLog = label => {
                log = log ? log + "," + label : label
            }

            onAfterMount(() => {
                const inst = getCurrentInstance()
                const isAppRoot =
                    inst !== null && !!inst.host && inst.host.id === "app" && inst.parent === null
                appendLog(isAppRoot ? "parent:app:root" : "parent:bad")
            })

            const toggleProbe = () => {
                showProbe = !showProbe
            }

            const bumpVersion = () => {
                version++
            }

            const checkOutsideHooks = () => {
                const inst = getCurrentInstance()
                outsideProbe = inst === null ? "null" : "instance"
            }
        </lang-js>

        <section data-page="component-get-current-instance">
            <h1 id="title">getCurrentInstance in hooks</h1>
            <p id="hook-log">{log}</p>
            <p id="outside-probe">Outside: {outsideProbe}</p>
            <button id="toggle-btn" @click={toggleProbe}>Toggle probe</button>
            <button id="update-btn" @click={bumpVersion}>Update</button>
            <button id="outside-btn" @click={checkOutsideHooks}>Check outside</button>
            <InstanceProbe #if={showProbe} !version={version} @appendLog={appendLog} />
        </section>
    `,
    components: {
        InstanceProbe: `
            <lang-js>
                import { getCurrentInstance } from "qingkuai"
                import {
                    onAfterMount,
                    onBeforeUpdate,
                    onAfterUpdate,
                    onBeforeDestroy,
                    onAfterDestroy
                } from "qingkuai"

                export let label = "probe"
                export let count = reactive(0)

                function increment() {
                    count++
                }
                export { increment }

                let captured = null

                onAfterMount(() => {
                    const inst = getCurrentInstance()
                    const ok =
                        inst !== null &&
                        !!inst.host &&
                        inst.parent !== null &&
                        inst.label === label &&
                        inst.count === count &&
                        typeof inst.increment === "function"
                    captured = inst
                    window.__probeInstance = inst
                    props.appendLog(ok ? "mount:ok:exports" : "mount:bad")
                })

                onBeforeUpdate(() => {
                    const inst = getCurrentInstance()
                    const same = inst === captured
                    const labelOk =
                        inst !== null && inst.label === label && typeof inst.increment === "function"
                    props.appendLog(same ? "before:same" : "before:diff")
                    props.appendLog(labelOk ? "label" : "nolabel")
                })

                onAfterUpdate(() => {
                    const inst = getCurrentInstance()
                    const same = inst === captured
                    props.appendLog(same ? "after:same" : "after:diff")
                })

                onBeforeDestroy(() => {
                    const inst = getCurrentInstance()
                    props.appendLog(inst === captured ? "before-destroy:same" : "before-destroy:diff")
                })

                onAfterDestroy(() => {
                    const inst = getCurrentInstance()
                    props.appendLog(inst === captured ? "after-destroy:same" : "after-destroy:diff")
                })
            </lang-js>

            <div id="probe-panel">
                <p id="probe-count">Count: {count}</p>
                <p id="probe-version">Version: {props.version}</p>
            </div>
        `
    }
}

const readProbeInstance = (page: E2EPageEvaluator) =>
    page.evaluate(() => (globalThis as any).__probeInstance)

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("app root instance is exposed during its own onAfterMount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#hook-log")).toHaveText("parent:app:root")
    })

    test("child instance with host is exposed during its onAfterMount", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#hook-log")).toHaveText("parent:app:root")

        await page.locator("#toggle-btn").click()
        await expect(page.locator("#probe-panel")).toBeVisible()
        await expect(page.locator("#hook-log")).toHaveText("parent:app:root,mount:ok:exports")
    })

    test("update hooks reuse the same instance and see exported data", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#toggle-btn").click()
        await expect(page.locator("#hook-log")).toHaveText("parent:app:root,mount:ok:exports")

        await page.locator("#update-btn").click()
        await expect(page.locator("#hook-log")).toHaveText(
            "parent:app:root,mount:ok:exports,before:same,label,after:same"
        )
    })

    test("instance captured in onAfterMount is the live component instance", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#toggle-btn").click()
        await expect(page.locator("#hook-log")).toHaveText("parent:app:root,mount:ok:exports")

        const inst = await readProbeInstance(page)
        expect(inst).not.toBeNull()
        expect(inst.label).toBe("probe")
        expect(inst.count).toBe(0)
        const incrementType = await page.evaluate(
            () => typeof (globalThis as any).__probeInstance.increment
        )
        expect(incrementType).toBe("function")

        await page.evaluate(() => (globalThis as any).__probeInstance.increment())
        await expect(page.locator("#probe-count")).toHaveText("Count: 1")
        await expect(page.locator("#hook-log")).toHaveText(
            "parent:app:root,mount:ok:exports,before:same,label,after:same"
        )
        expect((await readProbeInstance(page)).count).toBe(1)
    })

    test("remount creates a fresh instance for the new hooks run", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#toggle-btn").click()
        await expect(page.locator("#hook-log")).toHaveText("parent:app:root,mount:ok:exports")

        const firstInstance = await readProbeInstance(page)
        expect(firstInstance).not.toBeNull()

        await page.locator("#toggle-btn").click()
        await expect(page.locator("#probe-panel")).toHaveCount(0)

        await page.locator("#toggle-btn").click()
        await expect(page.locator("#probe-panel")).toBeVisible()
        await expect(page.locator("#hook-log")).toHaveText(
            "parent:app:root,mount:ok:exports,before-destroy:same,after-destroy:same,mount:ok:exports"
        )

        const secondInstance = await readProbeInstance(page)
        expect(secondInstance).not.toBe(firstInstance)
        expect(secondInstance.count).toBe(0)
    })

    test("destroy hooks see the same instance and outside hooks returns null", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#toggle-btn").click()
        await expect(page.locator("#hook-log")).toHaveText("parent:app:root,mount:ok:exports")

        await page.locator("#toggle-btn").click()
        await expect(page.locator("#probe-panel")).toHaveCount(0)
        await expect(page.locator("#hook-log")).toHaveText(
            "parent:app:root,mount:ok:exports,before-destroy:same,after-destroy:same"
        )

        await page.locator("#outside-btn").click()
        await expect(page.locator("#outside-probe")).toHaveText("Outside: null")
    })
})
