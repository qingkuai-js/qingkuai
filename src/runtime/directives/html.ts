import type { Getter } from "#type-declarations/tools"
import type { Destruction, HTMLBlockOptions } from "#type-declarations/runtime"

import { len } from "../../util/shared/sundry"
import { createFragmentGetter } from "../internal"
import { renderEffect } from "../reactivity/effect"
import { createDestruction, destroy } from "../destroy"

export function htmlBlock(getValue: Getter<string>, getOptions: Getter<HTMLBlockOptions>) {
    let html: string | undefined
    let destruction: Destruction | undefined
    let options: HTMLBlockOptions | undefined

    renderEffect(() => {
        const newHtml = "" + getValue()
        const newOptions = getOptions()
        if (newHtml == html && newOptions === options) {
            return
        }

        const escapeTags = newOptions.escapeTags || []
        if (newOptions.escapeStyle) {
            escapeTags.push("style")
        }
        if (newOptions.escapeScript) {
            escapeTags.push("script")
        }
        if (((html = newHtml), len(escapeTags))) {
            html = html.replaceAll(
                new RegExp(`</?(?:${escapeTags!.join("|")})`, "g"),
                matchStr => "&lt;" + matchStr.slice(1)
            )
        }

        const newDestruction = createDestruction()
        destruction && destroy(destruction)
        createFragmentGetter(html)()
        destruction = newDestruction
        options = newOptions
    })
}
