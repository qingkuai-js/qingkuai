import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import Switch from "./components/ui/Switch"

            let items = reactive([
                {
                    id: 1,
                    label: "A",
                    checked: false
                },
                {
                    id: 2,
                    label: "B",
                    checked: false
                }
            ])
        </lang-js>

        <section data-page="spread-nested">
            <qk:spread #key={item.id} #for={item of items}>
                <qk:spread>
                    <Switch !label={item.label} />
                </qk:spread>
                <span class="extra">tail-{item.label}</span>
            </qk:spread>
        </section>
    `,
    components: {
        "ui/Switch": `
            <lang-js>
                function onClick() {
                    refs.checked = !refs.checked
                }
            </lang-js>

            <button type="button" class="sw" @click={onClick}>
                <span class="k">...</span>
            </button>
            <span class="sw-label" #if={props.label}>{props.label}</span>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("nested spread with component child in keyed for renders data-aligned", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("span.extra")).toHaveText(["tail-A", "tail-B"])
        await expect(page.locator("span.sw-label")).toHaveText(["A", "B"])
        await expect(page.locator("button.sw")).toHaveCount(2)
    })
})
