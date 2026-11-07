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

            const onPlain = event => {
                push("plain:" + event.target.id + ":" + event.currentTarget.id)
            }

            const onManual = event => {
                event.stopPropagation()
                push("manual:" + event.target.id + ":" + event.currentTarget.id)
            }

            const onModifier = () => {
                push("modifier")
            }

            const onCheckbox = event => {
                event.preventDefault()
                push("checkbox:" + event.target.checked)
            }

            onAfterMount(() => {
                document.addEventListener("click", () => {
                    push("native")
                })
            })
        </lang-js>

        <section data-page="event-binding-native-propagation">
            <div
                id="outer"
                @click={onOuter}
            >
                <button
                    id="plain"
                    @click={onPlain}
                >
                    Plain
                </button>
                <button
                    id="manual"
                    @click={onManual}
                >
                    Manual
                </button>
                <button
                    id="modifier"
                    @click|stop={onModifier}
                >
                    Modifier
                </button>
            </div>
            <label
                id="check-label"
                for="agree"
            >
                <input
                    id="agree"
                    type="checkbox"
                    @click={onCheckbox}
                />
                Agree
            </label>
            <p id="log">{log}</p>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("a handler that does not stop propagation leaves the native listener alone", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#plain").click();
        await expect(page.locator("#log")).toHaveText("plain:plain:plain,outer,native");
    });

    test("calling stopPropagation inside a handler stops both halves", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#manual").click();
        await expect(page.locator("#log")).toHaveText("manual:manual:manual");
    });

    test("the stop modifier also stops the native listener", async ({ page, visitScenario }) => {
        await visitScenario(scenario);

        await page.locator("#modifier").click();
        await expect(page.locator("#log")).toHaveText("modifier");
    });

    test("calling preventDefault inside a handler cancels the default action", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#agree").click();
        await expect(page.locator("#agree")).not.toBeChecked();
        await expect(page.locator("#log")).toHaveText("checkbox:true,native");
    });
});
