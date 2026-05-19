import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import FormatPanel from "./components/ui/FormatPanel"

            let kebabTagLog = ""
            let camelTagLog = ""
            let kebabAttrLog = ""
            let camelAttrLog = ""

            const onSaveDoneForKebabTag = payload => {
                kebabTagLog = payload
            }

            const onSaveDoneForCamelTag = payload => {
                camelTagLog = payload
            }

            const onSaveDoneForKebabAttr = payload => {
                kebabAttrLog = payload
            }

            const onSaveDoneForCamelAttr = payload => {
                camelAttrLog = payload
            }
        </lang-js>

        <section data-page="component-attribute-formats">
            <p id="kebab-tag-log">{kebabTagLog}</p>
            <p id="camel-tag-log">{camelTagLog}</p>
            <p id="kebab-attr-log">{kebabAttrLog}</p>
            <p id="camel-attr-log">{camelAttrLog}</p>

            <format-panel
                featured
                title-text="Shared title"
                @save-done={onSaveDoneForKebabTag}
            />

            <FormatPanel
                featured
                titleText="Shared title"
                @save-done={onSaveDoneForCamelTag}
            />

            <format-panel
                featured
                title-text="Equivalent title"
                @save-done={onSaveDoneForKebabAttr}
            />

            <format-panel
                !featured={true}
                titleText="Equivalent title"
                @saveDone={onSaveDoneForCamelAttr}
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
    test("treats kebab-case and PascalCase component tags equivalently", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const panels = page.locator(".format-panel")
        await expect(panels.nth(0).locator(".format-title")).toHaveText("Shared title")
        await expect(panels.nth(1).locator(".format-title")).toHaveText("Shared title")
        await expect(panels.nth(0).locator(".format-featured")).toHaveText("yes")
        await expect(panels.nth(1).locator(".format-featured")).toHaveText("yes")

        await panels.nth(0).locator(".format-emit").click()
        await panels.nth(1).locator(".format-emit").click()

        await expect(page.locator("#kebab-tag-log")).toHaveText("Shared title:true")
        await expect(page.locator("#camel-tag-log")).toHaveText("Shared title:true")
    })

    test("treats kebab-case and camelCase component attributes equivalently", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const panels = page.locator(".format-panel")
        await expect(panels.nth(2).locator(".format-title")).toHaveText("Equivalent title")
        await expect(panels.nth(3).locator(".format-title")).toHaveText("Equivalent title")
        await expect(panels.nth(2).locator(".format-featured")).toHaveText("yes")
        await expect(panels.nth(3).locator(".format-featured")).toHaveText("yes")

        await panels.nth(2).locator(".format-emit").click()
        await panels.nth(3).locator(".format-emit").click()

        await expect(page.locator("#kebab-attr-log")).toHaveText("Equivalent title:true")
        await expect(page.locator("#camel-attr-log")).toHaveText("Equivalent title:true")
    })
})
