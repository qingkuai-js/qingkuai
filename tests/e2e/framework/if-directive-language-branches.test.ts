import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let language = "other"

            const cycleLanguage = () => {
                language = language === "other"
                    ? "qk"
                    : language === "qk"
                        ? "js"
                        : language === "js"
                            ? "ts"
                            : "other"
            }
        </lang-js>

        <section data-page="if-directive-language-branches">
            <h1 id="if-title">If directive</h1>

            <button
                id="cycle-language"
                @click={cycleLanguage}
            >
                Cycle language
            </button>

            <div id="language-branch">
                <p
                    #if={language === "qk"}
                    id="lang-qk"
                >
                    Qingkuai
                </p>
                <p
                    #elif={language === "js"}
                    id="lang-js"
                >
                    JavaScript
                </p>
                <p
                    #elif={language === "ts"}
                    id="lang-ts"
                >
                    TypeScript
                </p>
                <p
                    #else
                    id="lang-other"
                >
                    Other language
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports if elif else branch switching", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#lang-other")).toHaveText("Other language")

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-qk")).toHaveText("Qingkuai")

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-js")).toHaveText("JavaScript")

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-ts")).toHaveText("TypeScript")

        await page.locator("#cycle-language").click()
        await expect(page.locator("#lang-other")).toHaveText("Other language")
    })
})
