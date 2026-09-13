import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let config = {
                label: "v1"
            }
            let user = reactive({
                name: "u1"
            })
            let plain = ""
            let watched = ""
            let visible = true

            effect(() => {
                watched = user.name + " / " + raw(config).label
            })

            const update = () => {
                config = {
                    label: "v2"
                }
                user.name = "u2"
            }
        </lang-js>

        <section data-page="raw-read">
            <p id="untracked">{raw(config).label}</p>
            <p id="tracked">{user.name}</p>
            <p id="mixed">{user.name + " / " + raw(config).label}</p>
            <p id="untracked-reactive">{raw(user).name}</p>
            <p id="watched">{watched}</p>

            <input id="plain-input" &value={raw(plain)} />
            <p id="plain-mirror">{plain.length}</p>

            <div id="branch" #if={visible}>
                <p id="branch-raw">{raw(user).name}</p>
                <p id="branch-tracked">{user.name}</p>
            </div>
            <button id="toggle" @click={visible = !visible}>toggle</button>

            <button id="update" @click={update}>update</button>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("raw reads do not update the DOM while tracked reads do", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#untracked")).toHaveText("v1")
        await expect(page.locator("#tracked")).toHaveText("u1")
        await expect(page.locator("#mixed")).toHaveText("u1 / v1")
        await expect(page.locator("#untracked-reactive")).toHaveText("u1")
        await expect(page.locator("#watched")).toHaveText("u1 / v1")

        await page.locator("#update").click()
        await expect(page.locator("#tracked")).toHaveText("u2")
        await expect(page.locator("#untracked")).toHaveText("v1")
        await expect(page.locator("#untracked-reactive")).toHaveText("u1")

        // effect 重跑时 raw 部分按最新值求值：update 已把 config 改为 v2
        // When the effect re-runs, the raw part is evaluated with the
        // latest value: update has changed config to v2
        await expect(page.locator("#watched")).toHaveText("u2 / v2")
    })

    test("mixed expressions re-run with fresh values from raw parts", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await page.locator("#update").click()
        await expect(page.locator("#mixed")).toHaveText("u2 / v2")
    })

    test("whole-block raw inside a branch renders once and re-evaluates on re-render", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#branch-raw")).toHaveText("u1")
        await expect(page.locator("#branch-tracked")).toHaveText("u1")

        await page.locator("#update").click()
        await expect(page.locator("#branch-tracked")).toHaveText("u2")
        await expect(page.locator("#branch-raw")).toHaveText("u1")

        // 分支销毁重建（条件切换）时重新求值，取得当前值
        // When the branch is destroyed and rebuilt (condition toggled),
        // it re-evaluates and gets the current value
        await page.locator("#toggle").click()
        await expect(page.locator("#branch-raw")).toHaveCount(0)
        await page.locator("#toggle").click()
        await expect(page.locator("#branch-raw")).toHaveText("u2")
    })

    test("reference attribute with raw keeps the write channel on a plain value", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#plain-mirror")).toHaveText("0")
        await page.locator("#plain-input").fill("abc")
        await expect(page.locator("#plain-input")).toHaveValue("abc")
        await expect(page.locator("#plain-mirror")).toHaveText("0")
    })
})
