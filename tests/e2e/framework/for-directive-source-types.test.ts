import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let count = 3
            let word = "QK"
            let objectItems = {
                qk: "QingKuai",
                js: "JavaScript"
            }
            let mapItems = new Map([
                ["qk", "QingKuai"],
                ["js", "JavaScript"]
            ])
            let setItems = new Set(["S1", "S2"])

            const updateSources = () => {
                count = 2
                word = "TS"
                setItems = new Set(["S2", "S3"])
                mapItems = new Map([
                    ["ts", "TypeScript"],
                    ["qk", "QingKuai"]
                ])
                objectItems = {
                    ts: "TypeScript",
                    qk: "QingKuai"
                }
            }
        </lang-js>

        <section data-page="for-directive-source-types">
            <button id="update-sources" @click={updateSources}>Update sources</button>

            <div id="for-number-host">
                <span #for={count} class="for-number-item">N</span>
            </div>

            <div id="for-string-host">
                <span
                    class="for-string-item"
                    #for={char, index of word}
                >
                    {index}:{char}
                </span>
            </div>

            <div id="for-set-host">
                <span
                    class="for-set-item"
                    #for={item of setItems}
                >
                    {item}
                </span>
            </div>

            <div id="for-map-host">
                <span
                    class="for-map-item"
                    #for={value, key of mapItems}
                >
                    {key}:{value}
                </span>
            </div>

            <div id="for-object-host">
                <span
                    class="for-object-item"
                    #for={value, key of objectItems}
                >
                    {key}:{value}
                </span>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports number string set map and object as for sources", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#for-number-host .for-number-item")).toHaveCount(3)
        await expect(page.locator("#for-string-host .for-string-item")).toHaveText(["0:Q", "1:K"])
        await expect(page.locator("#for-set-host .for-set-item")).toHaveText(["S1", "S2"])
        await expect(page.locator("#for-map-host .for-map-item")).toHaveText([
            "qk:QingKuai",
            "js:JavaScript"
        ])
        await expect(page.locator("#for-object-host .for-object-item")).toHaveText([
            "qk:QingKuai",
            "js:JavaScript"
        ])

        await page.locator("#update-sources").click()
        await expect(page.locator("#for-number-host .for-number-item")).toHaveCount(2)
        await expect(page.locator("#for-string-host .for-string-item")).toHaveText(["0:T", "1:S"])
        await expect(page.locator("#for-set-host .for-set-item")).toHaveText(["S2", "S3"])
        await expect(page.locator("#for-map-host .for-map-item")).toHaveText([
            "ts:TypeScript",
            "qk:QingKuai"
        ])
        await expect(page.locator("#for-object-host .for-object-item")).toHaveText([
            "ts:TypeScript",
            "qk:QingKuai"
        ])
    })
})
