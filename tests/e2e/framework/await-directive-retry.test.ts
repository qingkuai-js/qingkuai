import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let attempts = 0

            const fetchData = () => {
                attempts = attempts + 1
                if (attempts === 1) {
                    return Promise.reject(new Error("first fail"))
                }
                return Promise.resolve("loaded")
            }
        </lang-js>

        <section data-page="await-directive-retry">
            <div #await={fetchData()}>
                <p id="pending">loading</p>
            </div>
            <div #then={value}>
                <p id="then-content">{value}</p>
            </div>
            <div #catch={{ err, retry }}>
                <p id="catch-content">failed: {err.message}</p>
                <button id="retry" @click={retry}>retry</button>
            </div>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("catch receives the rejection reason", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await expect(page.locator("#catch-content")).toHaveText("failed: first fail");
        await expect(page.locator("#then-content")).toHaveCount(0);
    });

    test("retry re-runs the promise and renders the then branch", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);
        await expect(page.locator("#catch-content")).toHaveText("failed: first fail");

        await page.locator("#retry").click();

        await expect(page.locator("#then-content")).toHaveText("loaded");
        await expect(page.locator("#catch-content")).toHaveCount(0);
        await expect(page.locator("#pending")).toHaveCount(0);
    });
});
