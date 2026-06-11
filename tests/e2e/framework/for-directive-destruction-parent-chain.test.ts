import type { E2EPageEvaluator, E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import RowPanel from "./components/RowPanel"

            let show = true
            let items = []

            globalThis.__log = []

            const appendLog = label => {
                globalThis.__log.push(label)
            }

            const addItem = () => {
                items = [{ id: 1, label: "Alpha" }]
            }

            const hideIf = () => {
                show = false
            }
        </lang-js>

        <section data-page="for-directive-destruction-parent-chain">
            <button id="btn-add" @click={addItem}>Add</button>
            <button id="btn-hide" @click={hideIf}>Hide</button>

            <div id="if-host" #if={show}>
                <RowPanel
                    #for={item of items}
                    #key={item.id}
                    !id={item.id}
                    !label={item.label}
                    @log={appendLog}
                />
            </div>
            <p id="if-hidden" #else>Hidden</p>
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

            <article class="row">{props.label}</article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    const readLog = (page: E2EPageEvaluator) => {
        return page.evaluate(() => ((globalThis as any).__log as string[]).slice())
    }

    test("for item inside if should be destroyed when if becomes false", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator(".row")).toHaveCount(0)

        await page.locator("#btn-add").click()
        await expect(page.locator(".row")).toHaveText("Alpha")
        await expect.poll(() => readLog(page)).toEqual(["mount-1"])

        await page.locator("#btn-hide").click()
        await expect(page.locator("#if-hidden")).toHaveText("Hidden")
        await expect(page.locator(".row")).toHaveCount(0)

        await expect
            .poll(() => readLog(page))
            .toEqual(["mount-1", "before-destroy-1", "after-destroy-1"])
    })
})
