import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let forItems = [
                { id: 1, html: '<span class="html-for-inner">For A</span>' },
                { id: 2, html: '<span class="html-for-inner">For B</span>' }
            ]

            const appendForItem = () => {
                forItems.push({
                    id: forItems.length + 1,
                    html: '<span class="html-for-inner">For ' + String.fromCharCode(64 + forItems.length + 1) + '</span>'
                })
            }

            const removeForItem = () => {
                if (forItems.length) {
                    forItems.pop()
                }
            }

            const updateForSecond = () => {
                if (forItems[1]) {
                    forItems[1].html = '<span class="html-for-inner">For B Updated</span>'
                }
            }
        </lang-js>

        <section data-page="html-directive-for">
            <h1 id="html-title">Html directive</h1>
            <div>
                <button id="html-for-append" @click={appendForItem()}>For append</button>
                <button id="html-for-remove" @click={removeForItem()}>For remove</button>
                <button id="html-for-update-second" @click={updateForSecond()}>For update second</button>
            </div>
            <ul id="html-for-host">
                <li #for={item of forItems} #key={item.id} #html>{item.html}</li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports html directive combined with for", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText(["For A", "For B"])

        await page.locator("#html-for-append").click()
        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText([
            "For A",
            "For B",
            "For C"
        ])

        await page.locator("#html-for-update-second").click()
        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText([
            "For A",
            "For B Updated",
            "For C"
        ])

        await page.locator("#html-for-remove").click()
        await expect(page.locator("#html-for-host .html-for-inner")).toHaveText([
            "For A",
            "For B Updated"
        ])
    })
})
