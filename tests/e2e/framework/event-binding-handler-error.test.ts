import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let log = ""

            const push = label => {
                log = log ? log + "," + label : label
            }

            const onOuter = () => {
                push("outer")
            }

            const onThrowing = () => {
                push("throwing")
                throw new Error("handler failed")
            }

            const onHealthy = () => {
                push("healthy")
            }
        </lang-js>

        <section data-page="event-binding-handler-error">
            <div
                id="outer"
                @click={onOuter}
            >
                <button
                    id="throwing"
                    @click={onThrowing}
                >
                    Throwing
                </button>
            </div>
            <button
                id="healthy"
                @click={onHealthy}
            >
                Healthy
            </button>
            <p id="log">{log}</p>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("a throwing handler is reported but does not break the walk", async ({
        page,
        visitScenario,
    }) => {
        const pageErrors: string[] = [];
        page.on("pageerror", error => {
            pageErrors.push(error.message);
        });

        await visitScenario(scenario);
        await page.locator("#throwing").click();

        await expect(page.locator("#log")).toHaveText("throwing,outer");
        await expect.poll(() => pageErrors.join("\n")).toContain("handler failed");
    });

    test("later events keep working after a handler threw", async ({ page, visitScenario }) => {
        const pageErrors: string[] = [];
        page.on("pageerror", error => {
            pageErrors.push(error.message);
        });

        await visitScenario(scenario);
        await page.locator("#throwing").click();
        await expect.poll(() => pageErrors.join("\n")).toContain("handler failed");

        await page.locator("#healthy").click();
        await expect(page.locator("#log")).toHaveText("throwing,outer,healthy");
    });
});
