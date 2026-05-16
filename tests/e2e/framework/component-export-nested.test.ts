import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import ParentComponent from "./components/export/ParentComponent"

            let parentHandle = null
            let childHandle = null

            const callParentInc = () => {
                if (parentHandle) {
                    parentHandle.increment()
                }
            }

            const callChildInc = () => {
                if (childHandle) {
                    childHandle.increment()
                }
            }

            const getParentState = () => {
                return "Parent: " + (parentHandle ? parentHandle.count : "null")
            }

            const getChildState = () => {
                return "Child: " + (childHandle ? childHandle.read() : "null")
            }

            const onChildHandle = handle => {
                childHandle = handle
            }
        </lang-js>

        <section data-page="component-export-nested">
            <p id="parent-state">{getParentState()}</p>
            <p id="child-state">{getChildState()}</p>

            <button id="btn-parent-inc" @click={callParentInc}>Increment Parent</button>
            <button id="btn-child-inc" @click={callChildInc}>Increment Child</button>

            <ParentComponent &handle={parentHandle} @childHandle={onChildHandle} />
        </section>
    `,
    components: {
        "export/ParentComponent": `
            <lang-js>
                import ChildComponent from "./ChildComponent"

                export let count = 0

                function increment() {
                    count++
                }

                export { increment }

                let childHandle = null

                const onChildHandle = (handle) => {
                    childHandle = handle
                    props.childHandle(handle)
                }
            </lang-js>

            <div class="parent-component">
                <p id="parent-count">Parent count: {count}</p>
                <button id="parent-btn" @click={increment}>Inc in parent</button>
                <ChildComponent @handle={onChildHandle} />
            </div>
        `,
        "export/ChildComponent": `
            <lang-js>
                import { onAfterMount } from "qingkuai"

                export let count = 0

                function increment() {
                    count++
                }

                export { increment }

                const notifyParent = () => {
                    props.handle({
                        increment,
                        read: () => count
                    })
                }

                onAfterMount(() => {
                    notifyParent()
                })
            </lang-js>

            <div class="child-component">
                <p id="child-count">Child count: {count}</p>
                <button id="child-btn" @click={increment}>Inc in child</button>
            </div>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("export binding works with nested component hierarchies", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#parent-state")).toHaveText("Parent: 0")
        await expect(page.locator("#child-state")).toHaveText("Child: 0")

        await page.locator("#btn-parent-inc").click()
        await expect(page.locator("#parent-state")).toHaveText("Parent: 1")
        await expect(page.locator("#parent-count")).toHaveText("Parent count: 1")

        await page.locator("#btn-child-inc").click()
        await expect(page.locator("#child-state")).toHaveText("Child: 1")
        await expect(page.locator("#child-count")).toHaveText("Child count: 1")

        await page.locator("#btn-parent-inc").click()
        await page.locator("#btn-parent-inc").click()
        await expect(page.locator("#parent-state")).toHaveText("Parent: 3")

        await page.locator("#btn-child-inc").click()
        await expect(page.locator("#child-state")).toHaveText("Child: 2")

        await page.locator("#parent-btn").click()
        await expect(page.locator("#parent-count")).toHaveText("Parent count: 4")

        await page.locator("#child-btn").click()
        await expect(page.locator("#child-count")).toHaveText("Child count: 3")
    })

    test("nested component export bindings are independent", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#child-btn").click()
        await page.locator("#child-btn").click()
        await page.locator("#child-btn").click()
        await expect(page.locator("#child-count")).toHaveText("Child count: 3")

        await expect(page.locator("#parent-count")).toHaveText("Parent count: 0")
        await expect(page.locator("#parent-state")).toHaveText("Parent: 0")
        await expect(page.locator("#child-state")).toHaveText("Child: 3")

        await page.locator("#btn-parent-inc").click()

        await expect(page.locator("#child-count")).toHaveText("Child count: 3")
        await expect(page.locator("#parent-count")).toHaveText("Parent count: 1")
    })
})
