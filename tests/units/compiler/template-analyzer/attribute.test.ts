import { test, describe } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"

test("Directive names only need to be checked for duplication against other directive names", () => {
    for (const tag of ["span", "Comp"]) {
        if (tag === "Comp") {
            analyzeTemplateAndMatchMessages(`<${tag} &target={_} #target={_}></${tag}>`)
        }
        analyzeTemplateAndMatchMessages(`<${tag} target=" " #target={_}></${tag}>`)
        analyzeTemplateAndMatchMessages(`<${tag} !target={_} #target={_}></${tag}>`)
        analyzeTemplateAndMatchMessages(`<${tag} @target={_} #target={_}></${tag}>`)

        analyzeTemplateAndMatchMessages(`<${tag} #target={_} #target={_}></${tag}>`, [
            {
                type: "error",
                range: [18, 25],
                value: `Duplicate directives: "#target".`
            },
            {
                type: "error",
                range: [6, 13],
                value: `Duplicate directives: "#target".`
            }
        ])
    }
})

describe("Non-component tag", () => {
    test("Duplicate attributes", () => {
        analyzeTemplateAndMatchMessages(`<div id="" id=""></div>`, [
            {
                type: "error",
                range: [11, 13],
                value: `Duplicate static attributes: "id".`
            },
            {
                type: "error",
                range: [5, 7],
                value: `Duplicate static attributes: "id".`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div !id={_} id=""></div>`, [
            {
                type: "error",
                range: [13, 15],
                value: `Duplicate attributes: the dynamic attribute "!id" and the static attribute "id" resolve to the same attribute.`
            },
            {
                type: "error",
                range: [5, 8],
                value: `Duplicate attributes: the dynamic attribute "!id" and the static attribute "id" resolve to the same attribute.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<span id="" !id={_} &id={_}></span>`, [
            {
                type: "error",
                range: [12, 15],
                value: `Duplicate attributes: the static attribute "id" and the dynamic attribute "!id" resolve to the same attribute.`
            },
            {
                type: "error",
                range: [6, 8],
                value: `Duplicate attributes: the static attribute "id" and the dynamic attribute "!id" resolve to the same attribute.`
            },
            {
                type: "error",
                range: [20, 23],
                value: `Duplicate attributes: the dynamic attribute "!id" and the reference attribute "&id" resolve to the same attribute.`
            },
            {
                type: "error",
                range: [12, 15],
                value: `Duplicate attributes: the dynamic attribute "!id" and the reference attribute "&id" resolve to the same attribute.`
            },
            {
                type: "error",
                range: [20, 23],
                value: `The <span> tag only supports "&handle" as a reference attribute, but got: "&id".`
            }
        ])

        analyzeTemplateAndMatchMessages(`<lang-js shallow shallow></lang-js>`, [
            {
                type: "error",
                range: [17, 24],
                value: `Duplicate static attributes: "shallow".`
            },
            {
                type: "error",
                range: [9, 16],
                value: `Duplicate static attributes: "shallow".`
            }
        ])
    })

    test("Dynamic and static class attribute can coexist", () => {
        analyzeTemplateAndMatchMessages(`<div class="" !class={_}></div>`)

        analyzeTemplateAndMatchMessages(`<lang-js shallow !shallow></lang-js>`, [
            {
                type: "error",
                range: [17, 25],
                value: `The <lang-js> tag can only accept static attributes, but got a dynamic attribute: "!shallow".`
            }
        ])
    })

    test("Event names only need to be checked for duplication against other event names", () => {
        analyzeTemplateAndMatchMessages(`<div click="" @click={_}></div>`)
        analyzeTemplateAndMatchMessages(`<div @click={_} @click={_}></div>`, [
            {
                type: "error",
                range: [16, 22],
                value: `Duplicate event listeners: "@click".`
            },
            {
                type: "error",
                range: [5, 11],
                value: `Duplicate event listeners: "@click".`
            }
        ])
    })
})

describe("Component tag", () => {
    test("Duplicate attributes", () => {
        analyzeTemplateAndMatchMessages(`<Comp custom="" custom="" />`, [
            {
                type: "error",
                range: [16, 22],
                value: `Duplicate static attributes: "custom".`
            },
            {
                type: "error",
                range: [6, 12],
                value: `Duplicate static attributes: "custom".`
            }
        ])

        analyzeTemplateAndMatchMessages(`<Comp !id={_} id=""></Comp>`, [
            {
                type: "error",
                range: [14, 16],
                value: `Duplicate attributes: the dynamic attribute "!id" and the static attribute "id" resolve to the same prop.`
            },
            {
                type: "error",
                range: [6, 9],
                value: `Duplicate attributes: the dynamic attribute "!id" and the static attribute "id" resolve to the same prop.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<Comp custom="" !custom={_} @custom={_} />`, [
            {
                type: "error",
                range: [16, 23],
                value: `Duplicate attributes: the static attribute "custom" and the dynamic attribute "!custom" resolve to the same prop.`
            },
            {
                type: "error",
                range: [6, 12],
                value: `Duplicate attributes: the static attribute "custom" and the dynamic attribute "!custom" resolve to the same prop.`
            },
            {
                type: "error",
                range: [28, 35],
                value: `Duplicate attributes: the dynamic attribute "!custom" and the event listener "@custom" resolve to the same prop.`
            },
            {
                type: "error",
                range: [16, 23],
                value: `Duplicate attributes: the dynamic attribute "!custom" and the event listener "@custom" resolve to the same prop.`
            }
        ])
    })

    test("Dynamic and static class attribute cannot coexist", () => {
        analyzeTemplateAndMatchMessages(`<Comp class="" !class={_} />`, [
            {
                type: "error",
                range: [15, 21],
                value: `Duplicate attributes: the static attribute "class" and the dynamic attribute "!class" resolve to the same prop.`
            },
            {
                type: "error",
                range: [6, 11],
                value: `Duplicate attributes: the static attribute "class" and the dynamic attribute "!class" resolve to the same prop.`
            }
        ])
    })

    test("Reference attributes only need to be checked for duplication against other reference attributes", () => {
        analyzeTemplateAndMatchMessages(`<Comp custom="" &custom={_} />`)
        analyzeTemplateAndMatchMessages(`<Comp &custom={_} &custom={_} />`, [
            {
                type: "error",
                range: [18, 25],
                value: `Duplicate reference attributes: "&custom".`
            },
            {
                type: "error",
                range: [6, 13],
                value: `Duplicate reference attributes: "&custom".`
            }
        ])
    })
})

test("Embedded language tag only allowed static attributes", () => {
    for (const lang of ["js", "ts", "css", "scss", "sass", "less", "stylus", "postcss"]) {
        analyzeTemplateAndMatchMessages(`<lang-${lang} custom=""></lang-${lang}>`)
        analyzeTemplateAndMatchMessages(
            `<lang-${lang} !id={_} @click={_} #custom={_} &custom={_}></lang-${lang}>`,
            [
                {
                    type: "error",
                    range: [7 + lang.length, 14 + lang.length],
                    value: `The <lang-${lang}> tag can only accept static attributes, but got a dynamic attribute: "!id".`
                },
                {
                    type: "error",
                    range: [15 + lang.length, 25 + lang.length],
                    value: `The <lang-${lang}> tag can only accept static attributes, but got an event listener: "@click".`
                },
                {
                    type: "error",
                    range: [26 + lang.length, 37 + lang.length],
                    value: `The <lang-${lang}> tag can only accept static attributes, but got a directive: "#custom".`
                },
                {
                    type: "error",
                    range: [38 + lang.length, 49 + lang.length],
                    value: `The <lang-${lang}> tag can only accept static attributes, but got a reference attribute: "&custom".`
                }
            ]
        )
    }
})

test("The name attribute on slot tag must be static", () => {
    analyzeTemplateAndMatchMessages(`<slot name=""></slot>`)
    analyzeTemplateAndMatchMessages(`<slot !name={_} name="" &name={_}></slot>`, [
        {
            type: "error",
            range: [6, 11],
            value: `The "name" attribute on <slot> tag must be static.`
        },
        {
            type: "error",
            range: [24, 29],
            value: `The <slot> tag does not support reference attributes or event listeners, but got a reference attribute: "&name".`
        },
        {
            type: "error",
            range: [24, 29],
            value: `The "name" attribute on <slot> tag must be static.`
        }
    ])
})

test("The slot tag does not support reference attributes or event listeners", () => {
    analyzeTemplateAndMatchMessages(`<slot &custom={_} @click={_}></slot>`, [
        {
            type: "error",
            range: [6, 13],
            value: `The <slot> tag does not support reference attributes or event listeners, but got a reference attribute: "&custom".`
        },
        {
            type: "error",
            range: [18, 24],
            value: `The <slot> tag does not support reference attributes or event listeners, but got an event listener: "@click".`
        }
    ])
})

test("The SPREAD_TAG can only accept directives as attributes", () => {
    analyzeTemplateAndMatchMessages(`<qk:spread #target={_} #for={_}></qk:spread>`, [
        {
            type: "warning",
            range: [0, 10],
            value: `The <qk:spread> tag without children is unnecessary.`
        }
    ])
    analyzeTemplateAndMatchMessages(
        `<qk:spread id="" !custom={_} @click={_}  &value={_} #for={_}></qk:spread>`,
        [
            {
                type: "error",
                range: [11, 13],
                value: `The <qk:spread> tag can only accept directives, but got a static attribute: "id".`
            },
            {
                type: "error",
                range: [17, 24],
                value: `The <qk:spread> tag can only accept directives, but got a dynamic attribute: "!custom".`
            },
            {
                type: "error",
                range: [29, 35],
                value: `The <qk:spread> tag can only accept directives, but got an event listener: "@click".`
            },
            {
                type: "error",
                range: [41, 47],
                value: `The <qk:spread> tag can only accept directives, but got a reference attribute: "&value".`
            },
            {
                type: "warning",
                range: [0, 10],
                value: `The <qk:spread> tag without children is unnecessary.`
            }
        ]
    )
})

test("Attribute value is redundant for shallow attribute on embedded script language tag", () => {
    analyzeTemplateAndMatchMessages(`<lang-js shallow></lang-js>`)
    analyzeTemplateAndMatchMessages(`<lang-ts shallow="true"></lang-ts>`, [
        {
            type: "warning",
            range: [9, 23],
            value: `The "shallow" attribute on <lang-ts> tag is a boolean attribute, and the redundant attribute value will be ignored.`
        }
    ])
})

test("Attribute value is redundant for global attribute on embedded style language tag", () => {
    analyzeTemplateAndMatchMessages(`<lang-css global></lang-css>`)
    analyzeTemplateAndMatchMessages(`<lang-css global="true"></lang-css>`, [
        {
            type: "warning",
            range: [10, 23],
            value: `The "global" attribute on <lang-css> tag is a boolean attribute, and the redundant attribute value will be ignored.`
        }
    ])
})

test("Embedded script language tag can only accept one reactivity mmode attribute", () => {
    analyzeTemplateAndMatchMessages(`<lang-js reactive shallow></lang-js>`, [
        {
            type: "error",
            range: [18, 25],
            value: `Conflicting reactivity modes on <lang-js>: "reactive" and "shallow" cannot be used together.`
        },
        {
            type: "error",
            range: [9, 17],
            value: `Conflicting reactivity modes on <lang-js>: "reactive" and "shallow" cannot be used together.`
        }
    ])
})
