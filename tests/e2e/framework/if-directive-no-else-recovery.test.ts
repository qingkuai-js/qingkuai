import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let branch = "none"

            const cycleBranch = () => {
                branch = branch === "none"
                    ? "a"
                    : branch === "a"
                        ? "b"
                        : "none"
            }

            const rapidSwitch = () => {
                branch = "a"
                branch = "b"
                branch = "a"
            }
        </lang-js>

        <section data-page="if-directive-no-else-recovery">
            <h1 id="if-title">If directive no else</h1>
            <button id="cycle-branch" @click={cycleBranch}>Cycle branch</button>
            <button id="rapid-switch" @click={rapidSwitch}>Rapid switch</button>

            <div id="branch-host">
                <p
                    #if={branch === "a"}
                    id="branch-a"
                    class="if-branch"
                >
                    Branch A
                </p>
                <p
                    #elif={branch === "b"}
                    id="branch-b"
                    class="if-branch"
                >
                    Branch B
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("cleans active branch when no condition matches and restores on next hit", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const branches = page.locator("#branch-host .if-branch")

        await expect(branches).toHaveCount(0)

        await page.locator("#cycle-branch").click()
        await expect(page.locator("#branch-a")).toHaveText("Branch A")
        await expect(branches).toHaveCount(1)

        await page.locator("#cycle-branch").click()
        await expect(page.locator("#branch-b")).toHaveText("Branch B")
        await expect(branches).toHaveCount(1)

        await page.locator("#cycle-branch").click()
        await expect(branches).toHaveCount(0)

        await page.locator("#cycle-branch").click()
        await expect(page.locator("#branch-a")).toHaveText("Branch A")
        await expect(branches).toHaveCount(1)
    })

    test("keeps only one active branch after rapid state switches", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#rapid-switch").click()

        const branches = page.locator("#branch-host .if-branch")
        await expect(branches).toHaveCount(1)
        await expect(page.locator("#branch-a")).toHaveText("Branch A")
        await expect(page.locator("#branch-b")).toHaveCount(0)
    })
})
