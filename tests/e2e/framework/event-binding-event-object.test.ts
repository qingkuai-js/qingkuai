import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let mouse = ""
            let keyboard = ""
            let detail = ""
            let path = ""
            let immediate = ""

            const onMouse = event => {
                mouse = [
                    event.type,
                    event.target.id,
                    event.currentTarget.id,
                    event.button,
                    event.detail,
                    event.clientX >= 0
                ].join(":")
            }

            const onKey = event => {
                keyboard = [event.key, event.code, event.shiftKey].join(":")
            }

            const onDouble = event => {
                detail = "detail:" + event.detail
            }

            const onPath = event => {
                path = event.composedPath().indexOf(event.currentTarget) >= 0 ? "contains-self" : "missing"
            }

            const onImmediate = event => {
                event.stopImmediatePropagation()
                immediate = "inner"
            }

            const onImmediateOuter = () => {
                immediate = immediate ? immediate + ",outer" : "outer"
            }
        </lang-js>

        <section data-page="event-binding-event-object">
            <button
                id="mouse-btn"
                @click={onMouse}
            >
                Mouse
            </button>
            <p id="mouse">{mouse}</p>

            <input
                id="key-input"
                @keydown={onKey}
            />
            <p id="keyboard">{keyboard}</p>

            <button
                id="dbl-btn"
                @dblclick={onDouble}
            >
                Double
            </button>
            <p id="detail">{detail}</p>

            <button
                id="path-btn"
                @click={onPath}
            >
                Path
            </button>
            <p id="path">{path}</p>

            <div
                id="immediate-outer"
                @click={onImmediateOuter}
            >
                <button
                    id="immediate-inner"
                    @click={onImmediate}
                >
                    Immediate
                </button>
            </div>
            <p id="immediate">{immediate}</p>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("mouse fields are readable from the event object", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#mouse-btn").click();
        await expect(page.locator("#mouse")).toHaveText("click:mouse-btn:mouse-btn:0:1:true");
    });

    test("keyboard fields are readable from the event object", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#key-input").click();
        await page.keyboard.press("Shift+Enter");
        await expect(page.locator("#keyboard")).toHaveText("Enter:Enter:true");
    });

    test("double click keeps its detail count", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#dbl-btn").dblclick();
        await expect(page.locator("#detail")).toHaveText("detail:2");
    });

    test("composedPath is callable inside a handler", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#path-btn").click();
        await expect(page.locator("#path")).toHaveText("contains-self");
    });

    test("stopImmediatePropagation ends the remaining walk", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#immediate-inner").click();
        await expect(page.locator("#immediate")).toHaveText("inner");
    });
});
