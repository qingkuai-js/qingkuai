import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            import EventEmitterCard from "./components/events/EventEmitterCard"

            let total = 0
            let eventLog = ""

            const handleSaved = payload => {
                total += payload.step
                eventLog = eventLog ? eventLog + "," + payload.label : payload.label
            }
        </lang-js>

        <section data-page="component-events">
            <h1 id="component-events-title">Component Events</h1>
            <p id="event-total">Total: {total}</p>
            <p id="event-log">Log: {eventLog}</p>

            <EventEmitterCard
                !step={2}
                !label={"primary"}
                @saved={handleSaved}
            />

            <EventEmitterCard @saved={handleSaved} />
        </section>
    `,
    components: {
        "events/EventEmitterCard": `
            <lang-js>
                defaultProps({
                    step: 1,
                    label: "default"
                })

                const emitSaved = () => {
                    props.saved({
                        step: props.step,
                        label: props.label
                    })
                }
            </lang-js>

            <article class="event-emitter-card">
                <button class="emit-btn" @click={emitSaved}>Emit saved</button>
            </article>
        `
    }
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports component event callback passing and invocation", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const emitButtons = page.locator(".event-emitter-card .emit-btn")
        await emitButtons.nth(0).click()
        await expect(page.locator("#event-total")).toHaveText("Total: 2")
        await expect(page.locator("#event-log")).toHaveText("Log: primary")

        await emitButtons.nth(1).click()
        await expect(page.locator("#event-total")).toHaveText("Total: 3")
        await expect(page.locator("#event-log")).toHaveText("Log: primary,default")
    })
})
