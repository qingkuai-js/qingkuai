import type { Getter } from "#type-declarations/tools"
import type { Destruction } from "#type-declarations/runtime"
import type { HtmlBlockOptions } from "#type-declarations/runtime-ex"

import { destroy } from "../destroy"
import { invokeRender } from "./render"
import { renderEffect } from "../reactivity/effect"
import { SVG_NAMESPACE_URI } from "../constants"
import { currentDestruction, currentInstance } from "../state"
import { createFragmentGetter, createSvgFragmentGetter, insertBefore } from "../internal"

export function htmlBlock(anchor: Text, getValue: Getter, getOptions?: Getter) {
    let html: string | undefined
    let destruction: Destruction | undefined
    let options: HtmlBlockOptions | undefined

    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction

    const render = () => {
        // 锚点的父元素决定解析上下文：注入到 <svg> 内的标记必须按 SVG 命名空间解析
        // The anchor's parent decides the parsing context: markup injected into an
        // <svg> has to be parsed in the SVG namespace.
        const parent = anchor.parentNode as Element | null
        const getter =
            parent?.namespaceURI === SVG_NAMESPACE_URI
                ? createSvgFragmentGetter(html!)
                : createFragmentGetter(html!)
        insertBefore(anchor, getter())
    }

    renderEffect(() => {
        const newHtml = "" + getValue()
        const newOptions: HtmlBlockOptions = getOptions?.()
        if (newHtml == html && newOptions === options) {
            return
        }

        const escapeTags = newOptions?.escapeTags || []
        if (newOptions?.escapeStyle) {
            escapeTags.push("style")
        }
        if (newOptions?.escapeScript) {
            escapeTags.push("script")
        }
        if (((html = newHtml), escapeTags.length)) {
            html = html.replaceAll(
                new RegExp(`</?(?:${escapeTags!.join("|")})`, "g"),
                matchStr => "&lt;" + matchStr.slice(1)
            )
        }
        if (destruction) {
            destroy(destruction)
        }
        destruction = invokeRender(render, componentInstance, parentDestruction)
        options = newOptions
    })
}
