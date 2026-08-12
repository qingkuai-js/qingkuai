import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let plainCount = 0
            let enterCount = 0
            let ctrlEnterCount = 0
            let exactEnterCount = 0
            let upCount = 0
            let downCount = 0

            const incPlain = () => { plainCount++ }
            const incEnter = () => { enterCount++ }
            const incCtrlEnter = () => { ctrlEnterCount++ }
            const incExactEnter = () => { exactEnterCount++ }
            const incUp = () => { upCount++ }
            const incDown = () => { downCount++ }
        </lang-js>

        <section data-page="event-binding-key-mapping">
            <input id="plain-input" @keydown={incPlain} />
            <input id="enter-input" @keydown|enter={incEnter} />
            <input id="ctrl-enter-input" @keydown|ctrl|enter={incCtrlEnter} />
            <input id="exact-enter-input" @keydown|exact|enter={incExactEnter} />
            <input id="arrow-up-input" @keydown|up={incUp} />
            <input id="arrow-down-input" @keydown|down={incDown} />
            <p id="counts">{plainCount}|{enterCount}|{ctrlEnterCount}|{exactEnterCount}|{upCount}|{downCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("a handler without a key name fires for any (non-mapped) key", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#plain-input").press("a")
        await expect(page.locator("#counts")).toHaveText("1|0|0|0|0|0")
    })

    test("a key-named handler ignores plain keys and fires only for the mapped key", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#enter-input").press("a")
        await expect(page.locator("#counts")).toHaveText("0|0|0|0|0|0")

        await page.locator("#enter-input").press("Enter")
        await expect(page.locator("#counts")).toHaveText("0|1|0|0|0|0")

        // 未声明 shift 修饰符时不拦截 Shift+Enter
        // Shift+Enter is not intercepted when the shift modifier is not declared
        await page.locator("#enter-input").press("Shift+Enter")
        await expect(page.locator("#counts")).toHaveText("0|2|0|0|0|0")
    })

    test("a modifier-named handler requires the modifier key", async ({ page, visitScenario }) => {
        await visitScenario(scenario)
        await page.locator("#ctrl-enter-input").press("Enter")
        await expect(page.locator("#counts")).toHaveText("0|0|0|0|0|0")

        await page.locator("#ctrl-enter-input").press("Control+Enter")
        await expect(page.locator("#counts")).toHaveText("0|0|1|0|0|0")
    })

    test("exact blocks extra modifiers and allows the bare key", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#exact-enter-input").press("Shift+Enter")
        await expect(page.locator("#counts")).toHaveText("0|0|0|0|0|0")

        await page.locator("#exact-enter-input").press("Enter")
        await expect(page.locator("#counts")).toHaveText("0|0|0|1|0|0")
    })

    test("arrow key names discriminate between different arrows", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#arrow-up-input").press("ArrowDown")
        await expect(page.locator("#counts")).toHaveText("0|0|0|0|0|0")

        await page.locator("#arrow-up-input").press("ArrowUp")
        await expect(page.locator("#counts")).toHaveText("0|0|0|0|1|0")

        await page.locator("#arrow-down-input").press("ArrowDown")
        await expect(page.locator("#counts")).toHaveText("0|0|0|0|1|1")
    })
})
