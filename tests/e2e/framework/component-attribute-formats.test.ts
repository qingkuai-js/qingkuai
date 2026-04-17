import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import FormatPanel from "./components/ui/FormatPanel"

            let kebabLog = ""
            let camelLog = ""

            const onSaveDone = payload => {
                kebabLog = payload
            }

            const onSaveDoneCamel = payload => {
                camelLog = payload
            }
        </lang-js>

        <section data-page="component-attribute-formats">
            <p id="kebab-log">{kebabLog}</p>
            <p id="camel-log">{camelLog}</p>

            <format-panel
                featured
                title-text="Kebab title"
                @save-done={onSaveDone}
            />

            <FormatPanel
                !featured={false}
                titleText="Camel title"
                @saveDone={onSaveDoneCamel}
            />
        </section>
    `,
    components: {
        "ui/FormatPanel": `
            <lang-js>
                const emitSaved = () => {
                    props.saveDone(props.titleText + ":" + String(props.featured))
                }
            </lang-js>

            <article class="format-panel">
                <h3 class="format-title">{props.titleText}</h3>
                <p class="format-featured">{props.featured ? "yes" : "no"}</p>
                <button class="format-emit" @click={emitSaved}>Emit saved</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports static boolean component attributes", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const panels = page.locator(".format-panel")
        await expect(panels.nth(0).locator(".format-featured")).toHaveText("yes")
        await expect(panels.nth(1).locator(".format-featured")).toHaveText("no")
    })

    test("supports kebab-case and camelCase component tags attributes and events", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const panels = page.locator(".format-panel")
        await expect(panels.nth(0).locator(".format-title")).toHaveText("Kebab title")
        await expect(panels.nth(1).locator(".format-title")).toHaveText("Camel title")

        await panels.nth(0).locator(".format-emit").click()
        await panels.nth(1).locator(".format-emit").click()

        await expect(page.locator("#kebab-log")).toHaveText("Kebab title:true")
        await expect(page.locator("#camel-log")).toHaveText("Camel title:false")
    })
})
