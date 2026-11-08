import type { E2EScenarioInput } from "#type-declarations/testing";

import { defineE2ETestFile } from "../scenario-module";

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import CtxPanel from "./components/CtxPanel"
        </lang-js>

        <section data-page="component-slots-context-getter">
            <h1 id="title">Slot Context Getters</h1>

            <CtxPanel>
                <span id="live-text" #slot={ctx from "live"}>{ctx.count}</span>
                <span id="snapshot-text" #slot={{ count } from "snapshot"}>{count}</span>
            </CtxPanel>
        </section>
    `,
    components: {
        CtxPanel: `
            <lang-js>
                let count = reactive(1)

                const increase = () => {
                    count++
                }
            </lang-js>

            <article id="ctx-panel">
                <button id="btn-increase" @click={increase}>Increase</button>
                <div id="live-outlet"><slot name="live" !count={count} /></div>
                <div id="snapshot-outlet"><slot name="snapshot" !count={count} /></div>
            </article>
        `,
    },
};

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("reading context through the context object follows provider updates", async ({
        page,
        visitScenario,
    }) => {
        await visitScenario(scenario);
        await expect(page).toHaveTitle("component-slots-context-getter");

        await expect(page.locator("#live-text")).toHaveText("1");
        await expect(page.locator("#snapshot-text")).toHaveText("1");

        // 通过上下文对象读取：跟随提供者的响应式数据更新
        // Reading through the context object: follows the reactive data updates of the provider
        await page.locator("#btn-increase").click();
        await expect(page.locator("#live-text")).toHaveText("2");

        // 解构上下文对象：只取一次值，仍是快照
        // Destructuring the context object: only takes the value once, still a snapshot
        await expect(page.locator("#snapshot-text")).toHaveText("1");
    });
});
