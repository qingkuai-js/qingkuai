import { test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"

test("Event flag on component is redundant", () => {
    analyzeTemplateAndMatchMessages(`<Comp @click|prevent></Comp>`, [
        {
            type: "warning",
            range: [12, 20],
            value: `Event flags for component event listeners are redundant and will be ignored.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<Comp @click|self|capture={_} />`, [
        {
            type: "warning",
            range: [12, 25],
            value: `Event flags for component event listeners are redundant and will be ignored.`
        }
    ])
})

test("Flag name is whitespace", () => {
    analyzeTemplateAndMatchMessages(`<div @click|></div>`, [
        {
            type: "error",
            range: [12, 12],
            value: `Expected an event flag name.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<div @click|stop|></div>`, [
        {
            type: "error",
            range: [17, 17],
            value: `Expected an event flag name.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<div @click|passive||self={_}></div>`, [
        {
            type: "error",
            range: [20, 20],
            value: `Expected an event flag name.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<div @click|once|||stop|></div>`, [
        {
            type: "error",
            range: [17, 17],
            value: `Expected an event flag name.`
        },
        {
            type: "error",
            range: [18, 18],
            value: `Expected an event flag name.`
        },
        {
            type: "error",
            range: [24, 24],
            value: `Expected an event flag name.`
        }
    ])
})

test("Unrecognized event flag", () => {
    analyzeTemplateAndMatchMessages(`<input @input|custom={_} />`, [
        {
            type: "error",
            range: [14, 20],
            value: `Unrecognized event flag: "custom".`
        }
    ])

    analyzeTemplateAndMatchMessages(`<button @click|self|stpo|capture={()=>{}}></button>`, [
        {
            type: "error",
            range: [20, 24],
            value: `Unrecognized event flag: "stpo".`
        }
    ])
})

test("Conflicting event flags", () => {
    analyzeTemplateAndMatchMessages(`<button @click|passive|prevent></button>`, [
        {
            type: "error",
            range: [23, 30],
            value: `Conflicting event flags: "prevent" and "passive" cannot be used together.`
        },
        {
            type: "error",
            range: [15, 22],
            value: `Conflicting event flags: "prevent" and "passive" cannot be used together.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<button @click|passive|prevent={_}></button>`, [
        {
            type: "error",
            range: [23, 30],
            value: `Conflicting event flags: "prevent" and "passive" cannot be used together.`
        },
        {
            type: "error",
            range: [15, 22],
            value: `Conflicting event flags: "prevent" and "passive" cannot be used together.`
        }
    ])
})

test("Duplicate event flag", () => {
    analyzeTemplateAndMatchMessages(`<button @click|stop|stop></button>`, [
        {
            type: "warning",
            range: [20, 24],
            value: `Duplicate event flag "stop" is redundant and will be ignored.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<button @click|self|stop|self|prevent={_}></button>`, [
        {
            type: "warning",
            range: [25, 29],
            value: `Duplicate event flag "self" is redundant and will be ignored.`
        }
    ])
})

test("The key related event flag can only be used on keyboard events", () => {
    analyzeTemplateAndMatchMessages(`<div @click|enter></div>`, [
        {
            type: "warning",
            range: [12, 17],
            value: `The event flag "enter" only valid on keyboard events ("keyup", "keydown", "keypress"). It has no effect on "@click" and will be ignored.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<div @click|stop|enter|up|passive|down></div>`, [
        {
            type: "warning",
            range: [17, 22],
            value: `The event flag "enter" only valid on keyboard events ("keyup", "keydown", "keypress"). It has no effect on "@click" and will be ignored.`
        },
        {
            type: "warning",
            range: [23, 25],
            value: `The event flag "up" only valid on keyboard events ("keyup", "keydown", "keypress"). It has no effect on "@click" and will be ignored.`
        },
        {
            type: "warning",
            range: [34, 38],
            value: `The event flag "down" only valid on keyboard events ("keyup", "keydown", "keypress"). It has no effect on "@click" and will be ignored.`
        }
    ])
})
