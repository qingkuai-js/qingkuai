import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import OuterShell from "./components/layout/OuterShell"

            let title = "Outer shell"
            let badgeText = "Inner badge"
            let flagKind = "deep nested"

            const updateNested = () => {
                title = "Updated shell"
                badgeText = "Updated badge"
                flagKind = "updated deep nested"
            }
        </lang-js>

        <section data-page="component-nested-updates">
            <button id="update-nested" @click={updateNested}>Update nested</button>
            <OuterShell !title !badgeText !flagKind />
        </section>
    `,
    components: {
        "layout/OuterShell": `
            <lang-js>
                import ChildBadge from "./ChildBadge"
            </lang-js>

            <section id="outer-shell">
                <h2 id="outer-shell-title">{props.title}</h2>
                <ChildBadge !text={props.badgeText} !kind={props.flagKind} />
            </section>
        `,
        "layout/ChildBadge": `
            <lang-js>
                import TinyFlag from "./TinyFlag"
            </lang-js>

            <article id="nested-child-badge">
                <p id="nested-child-badge-text">{props.text}</p>
                <TinyFlag !kind={props.kind} />
            </article>
        `,
        "layout/TinyFlag": `
            <span id="nested-tiny-flag">{props.kind}</span>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports nested component update chain", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#outer-shell-title")).toHaveText("Outer shell")
        await expect(page.locator("#nested-child-badge-text")).toHaveText("Inner badge")
        await expect(page.locator("#nested-tiny-flag")).toHaveText("deep nested")

        await page.locator("#update-nested").click()
        await expect(page.locator("#outer-shell-title")).toHaveText("Updated shell")
        await expect(page.locator("#nested-child-badge-text")).toHaveText("Updated badge")
        await expect(page.locator("#nested-tiny-flag")).toHaveText("updated deep nested")
    })
})
