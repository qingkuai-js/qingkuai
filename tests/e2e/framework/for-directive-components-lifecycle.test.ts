import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import RowPanel from "./components/RowPanel"

            let nextId = 2
            let lifecycleLog = ""
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const appendLog = label => {
                lifecycleLog = lifecycleLog ? lifecycleLog + "," + label : label
            }

            const addItem = () => {
                nextId++
                items = [...items, { id: nextId, label: "Item " + nextId }]
            }

            const removeFirst = () => {
                if (items.length) {
                    items = items.slice(1)
                }
            }
        </lang-js>

        <section data-page="for-directive-components-lifecycle">
            <h1 id="for-title">For directive components lifecycle</h1>
            <p id="row-log">{lifecycleLog}</p>
            <button id="add-item" @click={addItem}>Add item</button>
            <button id="remove-first" @click={removeFirst}>Remove first</button>

            <div id="component-list">
                <RowPanel
                    #for={item of items}
                    #key={item.id}
                    !id={item.id}
                    !label={item.label}
                    @log={appendLog}
                />
            </div>
        </section>
    `,
    components: {
        RowPanel: `
            <lang-js>
                import { onAfterMount, onBeforeDestroy, onAfterDestroy } from "qingkuai"

                onAfterMount(() => {
                    props.log("mount-" + props.id)
                })

                onBeforeDestroy(() => {
                    props.log("before-destroy-" + props.id)
                })

                onAfterDestroy(() => {
                    props.log("after-destroy-" + props.id)
                })
            </lang-js>

            <article class="row-panel">{props.label}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("logs lifecycle when for removes component rows", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const log = page.locator("#row-log")

        await expect(page.locator("#component-list .row-panel")).toHaveCount(2)
        await expect(page.locator("#component-list")).toContainText("Alpha")
        await expect(page.locator("#component-list")).toContainText("Beta")
        await expect(log).toContainText("mount-1")
        await expect(log).toContainText("mount-2")

        await page.locator("#remove-first").click()
        await expect(page.locator("#component-list .row-panel")).toHaveText(["Beta"])
        await expect(log).toContainText("before-destroy-1")
        await expect(log).toContainText("after-destroy-1")
    })

    test("mounts only newly appended row component", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#add-item").click()
        await expect(page.locator("#component-list .row-panel")).toHaveCount(3)
        await expect(page.locator("#component-list")).toContainText("Alpha")
        await expect(page.locator("#component-list")).toContainText("Beta")
        await expect(page.locator("#component-list")).toContainText("Item 3")

        const logText = (await page.locator("#row-log").textContent()) ?? ""
        expect(logText).toContain("mount-3")
        expect(logText).not.toContain("before-destroy-")
        expect(logText).not.toContain("after-destroy-")
    })
})
