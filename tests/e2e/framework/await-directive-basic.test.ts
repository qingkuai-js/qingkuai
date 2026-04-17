import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let branchPromise = createPendingPromise()

            const resetBranch = () => {
                branchPromise = createPendingPromise()
            }

            const resolveBranch = () => {
                branchPromise = new Promise(resolve => {
                    setTimeout(() => resolve({ id: 7, name: "Qingkuai" }), 10)
                })
            }

            const rejectBranch = () => {
                branchPromise = new Promise((_, reject) => {
                    setTimeout(() => reject({ msg: "branch failed", code: 500 }), 10)
                })
            }
        </lang-js>

        <section data-page="await-directive-basic">
            <h1 id="await-title">Await directive</h1>

            <div>
                <button
                    id="branch-reset"
                    @click={resetBranch}
                >
                    Reset branch
                </button>
                <button
                    id="branch-resolve"
                    @click={resolveBranch}
                >
                    Resolve branch
                </button>
                <button
                    id="branch-reject"
                    @click={rejectBranch}
                >
                    Reject branch
                </button>
            </div>
            <div id="branch-block">
                <p
                    id="branch-await"
                    #await={branchPromise}
                >
                    Loading branch...
                </p>
                <p
                    id="branch-then"
                    #then={{ id: userId, name: userName }}
                >
                    Resolved user {userId}: {userName}
                </p>
                <p
                    id="branch-catch"
                    #catch={{ msg, code }}
                >
                    Rejected {code}: {msg}
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders await pending state and resolves into then branch", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("await-directive-basic")
        await expect(page.locator("#branch-await")).toHaveText("Loading branch...")

        await page.locator("#branch-resolve").click()
        await expect(page.locator("#branch-then")).toHaveText("Resolved user 7: Qingkuai")
    })

    test("renders catch branch after rejection and can reset back to await", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#branch-reject").click()
        await expect(page.locator("#branch-catch")).toHaveText("Rejected 500: branch failed")

        await page.locator("#branch-reset").click()
        await expect(page.locator("#branch-await")).toHaveText("Loading branch...")
    })
})
