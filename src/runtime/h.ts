import type { AnyObject } from "../util/types"
import type {
    KeyedInfo,
    UpdateFunc,
    Directive,
    GeneralFunc,
    PartialNode,
    RenderStructure,
    RenderContext,
    ValueOrValueArr,
    DestructionStruct,
    QingKuaiNodeStruct,
    EventStructure,
    ComponentStructure,
    TemplateStuOrModuleFunc,
    QingKuaiComponentConstructonParam
} from "./types"

import {
    createComponent,
    QingKuaiComponent,
    getCurrentInstance,
    invokeIndexedHooks,
    setCurrentInstance
} from "./instance"
import {
    combineContext,
    mockDirective,
    extendNks,
    isModuleFunc,
    newDestruction,
    getContextFuncGen
} from "../util/runtime"
import {
    usedEffectList,
    setUsedEffectList,
    clearUsedEffectList,
    withCleanUsedEffectList
} from "./reactivity/state"
import { nil } from "./constants"
import { InvalidMountNode } from "./message/error"
import { internalPreEffect } from "./reactivity/effect"
import { isArray, isFunction, isNull, lastElem, len, values } from "../util/shared"
import { text, listen, insert, element, destroy, setText, attribute, textNode } from "./dom"

export function render(
    instance: QingKuaiComponent,
    target: Node,
    reference: PartialNode = nil,
    context: RenderContext[] = [],
    isKeyedTop: boolean = false
) {
    let dst: DestructionStruct
    const properties = instance.__
    // if (!conf.exposeDsts) {
    //     dst = newDestruction()
    // }
    dst = properties.dst
    properties.context = context
    properties.ctx = getContextFuncGen(context)
    setCurrentInstance(instance)

    const ts = properties.ts
    const preInstance = getCurrentInstance()
    const keyedInfo: KeyedInfo = [{ nks: [], dst }]
    const renderEachTopBlock = (stu: TemplateStuOrModuleFunc) => {
        // prettier-ignore
        const nki = h(
            instance,
            stu,
            target,
            reference,
            true,
            context,
            dst,
            isKeyedTop
        )
        extendNks(keyedInfo[0].nks, nki)
    }
    invokeIndexedHooks(instance, 0)
    ts.forEach(renderEachTopBlock)
    invokeIndexedHooks(instance, 1)
    setCurrentInstance(preInstance!)
    return [keyedInfo, dst] as const
}

export const h = withCleanUsedEffectList(function (
    instance: QingKuaiComponent,
    stu: TemplateStuOrModuleFunc,
    target: Node,
    reference: PartialNode,
    shouldDestroy: boolean,
    context: RenderContext[],
    destruction: DestructionStruct,
    isKeyedTop: boolean = false
) {
    let dref: Text

    const { directive, toms } = toRenderStructure(stu, context)
    const isKeyedForModule = directive && directive.t === 1
    const isAliasModule = directive && directive.t === 2
    const destructionArr: DestructionStruct[] = []
    const isDirectiveModule = !isNull(directive)
    const times = directive?.v[0] ?? 1
    const keyedInfo: KeyedInfo = []

    const selfAttachUpdate = (fn: UpdateFunc) => {
        attachUpdate(fn, instance, destruction)
    }

    const selfAttachDestroy = (fn: GeneralFunc) => {
        attachDestroy(fn, destruction)
    }

    // 开始指令模块前的处理
    if (isDirectiveModule) {
        // const t = `--- ${
        //     directive.t === 1 ? "keyed-for" : directive?.v[1].length ? "for" : "if"
        // } ---`
        if (!isAliasModule) {
            dref = textNode("")
            insert(target, dref, reference)
            isKeyedTop ||= directive.t === 1
            selfAttachDestroy(() => destroy(dref!))
        }

        for (let i = 0; i < times; i++) {
            extendDsts(destructionArr)
        }
        destruction.c.add(destructionArr)

        const moduleUpdateFn = directive.v[2](
            instance,
            directive,
            target,
            dref!,
            context,
            destruction,
            destructionArr!,
            isKeyedTop,
            keyedInfo
        )
        if (moduleUpdateFn && !isAliasModule) {
            setUsedEffectList(directive.e)
            selfAttachUpdate(moduleUpdateFn)
            clearUsedEffectList()
        }
    }

    for (let i = 0; i < times; i++) {
        if (isDirectiveModule) {
            destruction = destructionArr[i]
        }
        keyedInfo.push({
            nks: [],
            dst: isKeyedForModule ? destruction || nil : nil
        })
        toms.forEach((tom: RenderStructure["toms"][number]) => {
            const qkNode: QingKuaiNodeStruct = { n: nil, text: "", attrs: {} }
            const [tag, content, attrs, events, ...children] = tom.template
            const currentContext = combineContext(directive, context, i)
            const currentKeyedInfo = lastElem(keyedInfo)
            const cif = isFunction(content)

            // 调用获取内容的函数
            const invokeGetter = (getter: Function) => {
                return getter(getContextFuncGen(currentContext, qkNode.n))
            }

            // 获取内容，函数则调用，否则直接返回
            const getValue = (getter: any) => {
                if (!isFunction(getter)) {
                    return getter
                }
                return invokeGetter(getter)
            }

            // 子组件，此时tag是组件实例
            if (isFunction(tag)) {
                const componentStu = tom.template as ComponentStructure
                const component = createComponent(componentStu)

                // prettier-ignore
                const [nki, dst] = render(
                    component,
                    target,
                    reference,
                    context,
                    isKeyedTop
                )
                shouldDestroy && destruction.c.add([dst])
                extendNks(currentKeyedInfo.nks, nki)
                return
            }

            // rstu是子命令模块
            if (tom.module) {
                const cki = h(
                    instance,
                    tom.module,
                    target,
                    dref || reference,
                    shouldDestroy,
                    currentContext,
                    destruction,
                    isKeyedTop
                )
                if (isKeyedTop) {
                    extendNks(currentKeyedInfo.nks, cki)
                }
                return
            }

            // 组件slot，此时content是插槽名称，attrs是参数列表，children是默认内容
            if (tag === "slot") {
                let slot = instance.__.slots[content as string]

                const attrsLen = len(attrs)
                const slotArgs: AnyObject = {}

                // 获取slot从子组件传递的参数
                const updateSlotContext = () => {
                    for (let i = 0; i < attrsLen; i += 2) {
                        slotArgs[attrs![i]] = invokeGetter(attrs![i + 1])
                    }
                }

                if (!slot) {
                    slot = children as TemplateStuOrModuleFunc[]
                }
                if (!isArray(slot[0])) {
                    slot = [slot as TemplateStuOrModuleFunc]
                }
                updateSlotContext()

                // 添加更slot参数上下文的副作用
                const effectList = values(usedEffectList)
                const md = mockDirective([[slotArgs]], effectList)
                const slotContext = combineContext(md, context, 0)
                const unsetEffect = internalPreEffect(updateSlotContext, effectList)
                attachDestroy(unsetEffect, destruction)

                // 渲染slot中的内容
                slot.forEach(tom => {
                    const nki = h(
                        instance,
                        tom,
                        target,
                        reference,
                        shouldDestroy,
                        slotContext,
                        destruction,
                        isKeyedTop
                    )
                    if (isKeyedTop) {
                        extendNks(currentKeyedInfo.nks, nki)
                    }
                })
                return
            }

            // 创建节点及处理textContent
            if (tag) {
                element(qkNode, tag)
                setText(qkNode, getValue(content), cif)
            } else {
                text(qkNode, getValue(content), cif)
            }
            if (isKeyedTop) {
                currentKeyedInfo.nks.push(qkNode.n!)
            }
            if (shouldDestroy || isDirectiveModule) {
                selfAttachDestroy(() => destroy(qkNode.n!))
            }
            if (cif) {
                selfAttachUpdate(() => {
                    return setText(qkNode, invokeGetter(content), true)
                })
            }
            insert(target, qkNode.n!, dref || reference)

            // 处理attributes
            if (attrs) {
                for (let i = 0; i < len(attrs); i += 2) {
                    let [key, value] = [attrs[i], attrs[i + 1]]
                    const attrValueIsFunction = isFunction(value)
                    // prettier-ignore
                    attribute(
                        qkNode,
                        key, 
                        getValue(value),
                        attrValueIsFunction
                    )
                    if (attrValueIsFunction) {
                        selfAttachUpdate(() => {
                            return attribute(qkNode, key, invokeGetter(value), true)
                        })
                    }
                }
            }

            // 处理events
            if (events) {
                for (let i = 0; i < len(events); i += 3) {
                    const [key, value, flag] = events.slice(i, i + 3) as EventStructure
                    selfAttachDestroy(listen(qkNode.n!, key, invokeGetter(value), flag))
                }
            }

            // 处理子节点
            for (const child of children) {
                const assertedChild = child as TemplateStuOrModuleFunc
                h(instance, assertedChild, qkNode.n!, nil, false, currentContext, destruction)
            }
        })
    }

    // 将空文本参考节点放至keyedInfo最后
    if (isDirectiveModule && isKeyedTop && !isAliasModule) {
        keyedInfo.push({ nks: [dref!], dst: nil })
    }

    // if (directive && directive.t === 1) {
    //     console.log(keyedInfo)
    // }

    return keyedInfo
})

// 创建应用
export function createApp(
    Component: typeof QingKuaiComponent,
    options: Partial<QingKuaiComponentConstructonParam> = {}
) {
    ;(["props", "refs", "slots"] as const).forEach(key => {
        if (!options[key]) {
            options[key] = {}
        }
    })
    return {
        mount: (selector: string) => {
            const target = document.querySelector(selector)
            if (!target) {
                InvalidMountNode(selector)
            } else {
                const app = new Component(options as any)
                render(app, target)
                return app
            }
        }
    }
}

// 扩展dsts并返回新元素
export function extendDsts(dsts: DestructionStruct[]) {
    const ret = newDestruction()
    dsts.push(ret)
    return ret
}

// 将TemplateStructure或ModuelFunc转换为RenderStructure
export function toRenderStructure(
    stus: ValueOrValueArr<TemplateStuOrModuleFunc>,
    context: RenderContext[] = [],
    directive: Directive = nil
) {
    let ret: RenderStructure = {
        toms: [],
        directive: nil
    }
    if (!isArray(stus) || (!isModuleFunc(stus[0]) && !isArray(stus[0]))) {
        stus = [stus] as TemplateStuOrModuleFunc[]
    }
    ;(stus as TemplateStuOrModuleFunc[]).forEach(stu => {
        const stuIsModuleFunc = isModuleFunc(stu)
        if (isNull(directive) && stuIsModuleFunc) {
            ret = stu(getContextFuncGen(context), context)
        } else {
            ret.directive = directive
            if (stuIsModuleFunc) {
                ret.toms.push({
                    module: stu,
                    template: []
                })
            } else {
                ret.toms.push({
                    module: nil,
                    template: stu
                })
            }
        }
    })
    return ret
}

// 添加更新函数
export function attachUpdate(
    fn: UpdateFunc,
    instance: QingKuaiComponent,
    destrcution: DestructionStruct
) {
    fn.instance = instance
    usedEffectList.forEach(([list]) => {
        list.add(fn)
        attachDestroy(() => list.delete(fn), destrcution)
    })
    clearUsedEffectList()
}

// 添加销毁函数
export function attachDestroy(fn: GeneralFunc, destruction: DestructionStruct) {
    destruction.v.push(fn)
}
