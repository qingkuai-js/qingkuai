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

            const onDelegated = event => {
                push("delegated:" + (event instanceof Event) + ":" + event.currentTarget.id)
            }

            const onNative = event => {
                push("native:" + (event instanceof Event) + ":" + event.currentTarget.id)
                event.stopPropagation()
            }

            onAfterMount(() => {
                document.addEventListener("click", () => {
                    push("doc")
                })
            })
        </lang-js>

        <section data-page="event-binding-native-modifier">
            <div
                id="outer"
                @click={onOuter}
            >
                <button
                    id="delegated"
                    @click={onDelegated}
                >
                    Delegated
                </button>
                <button
                    id="native"
                    @click|native={onNative}
                >
                    Native
                </button>
            </div>
            <p id="log">{log}</p>
        </section>
    `,
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("a delegated handler still passes instanceof and re-targets currentTarget", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#delegated").click();
        await expect(page.locator("#log")).toHaveText("delegated:true:delegated,outer,doc");
    });

    test("|native hands over the real event and stops on its own", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);

        await page.locator("#native").click();

        // 委托在 document 捕获阶段跑完，原生监听在事件到达元素时才跑，因此祖先的委托处理器更早
        // Delegated handlers run on the document capture phase, so ancestors fire before the
        // native listener on the element itself.
        await expect(page.locator("#log")).toHaveText("outer,native:true:native");
    });
});
