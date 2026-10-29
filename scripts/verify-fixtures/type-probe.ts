import type { ComponentInstance, EffectHandle } from "qingkuai"
import type { CompileOptions, TemplateNode } from "qingkuai/compiler"

import "qingkuai/language-service"
import { createStore, watch, version } from "qingkuai"
import { compile, parseTemplate } from "qingkuai/compiler"

const store = createStore({ count: 0 })
const readCount = () => store.count
const handle: EffectHandle = watch(null, readCount, () => {})
handle.stop()

const options: CompileOptions = { debug: true }
const code: string = compile("<div></div>", options).code
const nodes: TemplateNode[] = parseTemplate("<div></div>")

export const probe: [
    typeof version,
    typeof store,
    ComponentInstance<any> | null,
    string,
    TemplateNode[]
] = [version, store, null, code, nodes]
