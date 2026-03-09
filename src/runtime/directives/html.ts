import type { Getter } from "#type-declarations/tools"
import type { Destruction, HtmlBlockOptions } from "#type-declarations/runtime"

import { destroy } from "../destroy"
import { len } from "../../util/shared/sundry"
import { renderEffect } from "../reactivity/effect"
import { invokeRender } from "../../util/runtime/sundry"
import { createFragmentGetter, insertBefore } from "../internal"

export function htmlBlock(anchor: Text, getValue: Getter, getOptions?: Getter) {
    let html: string | undefined
    let destruction: Destruction | undefined
    let options: HtmlBlockOptions | undefined

    renderEffect(() => {
        const newHtml = "" + getValue()
        const newOptions: HtmlBlockOptions = getOptions?.()
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
        destruction && destroy(destruction)
        destruction = invokeRender(() => {
            insertBefore(anchor, createFragmentGetter(html!)())
        })
        options = newOptions
    })
}
