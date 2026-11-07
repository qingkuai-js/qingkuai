import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let log = ""

            const push = label => {
                log = log ? log + "," + label : label
            }

            const onOuterCapture = () => {
                push("outer-capture")
            }

            const onOuter = () => {
                push("outer")
            }

            const onInner = () => {
                push("inner")
            }
        </lang-js>

        <section data-page="event-binding-non-bubbling">
            <div
                id="capture-wrap"
                @selectstart|capture={onOuterCapture}
            >
                <div
                    id="outer"
                    @selectstart={onOuter}
                >
                    <span
                        id="inner"
                        @selectstart={onInner}
                    >
                        select me
                    </span>
                </div>
            </div>
            <p id="log">{log}</p>
        </section>
    `,
};

// selectstart 是不冒泡事件，用它把"捕获照样经过祖先"与"祖先不该被通知冒泡"分开验证
// selectstart does not bubble; it separates "capture still passes through ancestors"
//  from "ancestors must not be told about a bubbling that never happens".
export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("ancestors are skipped for a non-bubbling event, capture still runs", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.evaluate(() => {
            document
                .querySelector("#inner")!
                .dispatchEvent(new Event("selectstart", { bubbles: false }));
        });
        await expect(page.locator("#log")).toHaveText("outer-capture,inner");
    });

    test("the same event still bubbles when it is dispatched as bubbling", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.evaluate(() => {
            document
                .querySelector("#inner")!
                .dispatchEvent(new Event("selectstart", { bubbles: true }));
        });
        await expect(page.locator("#log")).toHaveText("outer-capture,inner,outer");
    });
});
