import type {
    KeyedInfo,
    UpdateFunc,
    PartialNode,
    RenderContext,
    EventStructure,
    RenderStructure,
    DestructionStruct,
    QingKuaiNodeStruct,
    ComponentStructure,
    TemplateStuOrModuleFunc,
    QingKuaiComponentConstructonParam
} from "./types"
import type { AnyObject, GeneralFunc } from "../util/types"

import {
    createComponent,
    QingKuaiComponent,
    getCurrentInstance,
    invokeIndexedHooks,
    setCurrentInstance
} from "./instance"
import {
    extendNks,
    mockDirective,
    combineContext,
    newDestruction,
    getContextFuncGen
} from "../util/runtime/separate"
import {
    usedEffectList,
    setUsedEffectList,
    cleanUsedEffectList,
    withCleanUsedEffectList
} from "./reactivity/state"
import { velf } from "../util/runtime/sundry"
import { InvalidMountNode } from "./message/error"
import { isModuleFunc } from "../util/runtime/assert"
import { internalPreEffect } from "./reactivity/effect"
import { lastElem, len, values } from "../util/shared/sundry"
import { isArray, isFunction, isNull } from "../util/shared/assert"
import { ExposeDestructions, InstantiatedByH, IsWithReferenceRet, nil } from "./constants"
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
    if (ExposeDestructions) {
        dst = properties.dst
    } else {
        dst = newDestruction()
    }
    properties.ctx = getContextFuncGen(context)
    properties.context = context
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
    let rstu: RenderStructure
    let isInputOrOption = false
    let isInputOrTextarea = false

    if (!isModuleFunc(stu)) {
        rstu = {
            toms: [stu],
            directive: nil
        }
    } else {
        rstu = stu(getContextFuncGen(context))
    }

    const { directive, toms } = rstu
    const times = directive?.v[0] ?? 1
    const isDirectiveModule = !isNull(directive)
    const isAliasModule = isDirectiveModule && directive.t === 2
    const isKeyedForModule = isDirectiveModule && directive.t === 1

    const keyedInfo: KeyedInfo = []
    const destructionArr: DestructionStruct[] = []

    const attachUpdateLocal = (fn: UpdateFunc) => {
        attachUpdate(fn, instance, destruction)
    }

    const attachDestroyLocal = (fn: GeneralFunc) => {
        attachDestroy(fn, destruction)
    }

    // 开始指令模块前的处理
    if (isDirectiveModule) {
        if (!isAliasModule) {
            dref = textNode("")
            insert(target, dref, reference)
            isKeyedTop ||= directive.t === 1
            attachDestroyLocal(() => destroy(dref!))
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
            attachUpdateLocal(moduleUpdateFn)
            cleanUsedEffectList()
        }
        dref! && (reference = dref)
    }

    for (let i = 0; i < times; i++) {
        if (isDirectiveModule) {
            destruction = destructionArr[i]
        }
        keyedInfo.push({
            nks: [],
            dst: isKeyedForModule ? destruction || nil : nil
        })
        toms.forEach(tom => {
            const currentContext = combineContext(directive, context, i)
            const currentKeyedInfo = lastElem(keyedInfo)

            // rstu是子指令模块
            if (isModuleFunc(tom)) {
                const cki = h(
                    instance,
                    tom,
                    target,
                    reference,
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

            const qkNode: QingKuaiNodeStruct = { n: nil, text: "", attrs: {} }
            const [tag, content, attrs, events, ...children] = tom
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

            // 子组件，此时tag是组件标识符
            if (isFunction(tag)) {
                const componentStu = tom as ComponentStructure
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

            // 组件slot，此时content是插槽名称，attrs是参数列表，children是默认内容
            if (tag === "slot") {
                let slot = instance.__.slots[content as string]

                const attrsLen = len(attrs)
                const slotArgs: AnyObject = {}

                // 获取slot传递的参数
                const updateSlotContext = () => {
                    for (let i = 0; i < attrsLen; i += 2) {
                        slotArgs[attrs![i]] = getValue(attrs![i + 1])
                    }
                }

                if (!slot) {
                    if (!children.length) {
                        return
                    }
                    slot = children as TemplateStuOrModuleFunc[]
                }
                if (!isArray(slot[0])) {
                    slot = [slot as TemplateStuOrModuleFunc]
                }
                updateSlotContext()

                // 添加修改slot参数的副作用
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
            if (!tag) {
                text(qkNode, getValue(content), cif)
            } else {
                element(qkNode, tag)
                setText(qkNode, getValue(content), cif)

                // 判断元素是否为input、textarea或option，它们需要特殊处理：
                // 1. input和textarea元素的input事件需要避免在输入法合成阶段触发
                // 2. input和option元素的value属性无论是否是getter都需要被记录
                const isInput = tag === "input"
                isInputOrOption = isInput || tag === "option"
                isInputOrTextarea = isInput || tag === "textarea"
            }

            // 如果是option元素，把qkNode添加到DOM属性中，在处理select的引用
            // value属性值时，需要用到option元素的qkNode来调用attribute方法
            if (tag === "option") {
                ;(qkNode.n as any)["_qkNode"] = qkNode
            }

            if (isKeyedTop) {
                currentKeyedInfo.nks.push(qkNode.n!)
            }
            if (shouldDestroy || isDirectiveModule) {
                attachDestroyLocal(() => destroy(qkNode.n!))
            }
            if (cif) {
                attachUpdateLocal(() => {
                    return setText(qkNode, invokeGetter(content), true)
                })
            }
            insert(target, qkNode.n!, dref || reference)

            // 处理attributes
            if (attrs) {
                for (let i = 0; i < len(attrs); i += 2) {
                    let [key, value] = [attrs[i], attrs[i + 1]]
                    const attrValueIsFunction = isFunction(value)

                    // 设置节点属性值，最后一个参数代表是否需要记录旧属性值，它取决于下面的条件：
                    // 值非getter且非input、option元素的value属性（引用属性需要用到）时无需记录
                    attribute(
                        qkNode,
                        key,
                        getValue(value),
                        attrValueIsFunction || (isInputOrOption && key === "value")
                    )

                    // 如果属性值是一个getter，将修改属性的方法记录到响应性变量的effect列表中
                    // 记录完成后，当前attribue所依赖的响应性变量改变时，attribute将会被重新调用
                    if (attrValueIsFunction) {
                        attachUpdateLocal(() => {
                            return attribute(qkNode, key, invokeGetter(value), true)
                        })
                    }
                }
                attribute(qkNode, "qingkuai-" + instance.__.id, "", false)
            }

            // 处理events
            if (events) {
                for (let i = 0; i < len(events); i += 3) {
                    let eventHandler: EventListener
                    const stu = events.slice(i, i + 3) as EventStructure
                    const [eventName, eventHandlerGetter, eventFlag] = stu

                    // 判断是否是withReference方法的返回值，如果是的话则需要先调用它，它会返回真正的
                    // NormalEventHandlerGetter，调用时它会设置属性的初始值并将修改属性值的方法记录到
                    // 依赖的响应性变量的effect中（这一操作同上attribute处理部分，但这样做可以有效压缩生成代码体积）
                    if (!eventHandlerGetter[IsWithReferenceRet]) {
                        eventHandler = invokeGetter(eventHandlerGetter)
                    } else {
                        eventHandler = eventHandlerGetter(qkNode, invokeGetter, attachUpdateLocal)
                    }

                    // 将事件监听的销毁方法添加到destruction：移除节点时销毁事件监听处理器
                    const selfListen = (eventName: string, eventHandler: EventListener) => {
                        attachDestroyLocal(listen(qkNode.n!, eventName, eventHandler, eventFlag))
                    }

                    // 默认情况下输入合成阶段（如汉语拼音输入法合成过程中，即未选定输入前）不会触发input事件
                    // 如果为input事件传入了compose修饰符，则会在合成阶段触发input事件，下面的代码就针对这种
                    // 情况进行了处理。需要注意的是：在compositionend事件中调用了一次原始的input事件处理器，
                    // 因为在浏览器的默认行为中，选定输入的那一刻(通常为按下上方主键盘数字键或空格键选定)也被
                    // 算在合成过程中，而这里的处理将选定输入的操作排除在合成过程之外
                    if (!isInputOrTextarea || eventName !== "input" || velf(eventFlag, "compose")) {
                        selfListen(eventName, eventHandler)
                    } else {
                        selfListen("compositionend", eventHandler)
                        selfListen(eventName, event => {
                            if (!(event as InputEvent).isComposing) {
                                eventHandler(event)
                            }
                        })
                    }
                }
            }

            // 处理子节点
            for (const child of children) {
                const assertedChild = child as TemplateStuOrModuleFunc
                h(instance, assertedChild, qkNode.n!, nil, false, currentContext, destruction)
            }
        })
    }

    return keyedInfo
})

// 创建应用
export function createApp(
    selector: string,
    Component: typeof QingKuaiComponent,
    options: Partial<QingKuaiComponentConstructonParam> = {}
) {
    const target = document.querySelector(selector)
    ;(["props", "refs", "slots"] as const).forEach(key => {
        if (!options[key]) {
            options[key] = {}
        }
    })
    if (!target) {
        InvalidMountNode(selector)
    } else {
        // @ts-ignore
        const app = new Component({
            ...options,
            sign: InstantiatedByH
        })
        return render(app, target), app
    }
}

// 扩展dsts并返回新元素
export function extendDsts(dsts: DestructionStruct[]) {
    const ret = newDestruction()
    dsts.push(ret)
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
    cleanUsedEffectList()
}

// 添加销毁函数
export function attachDestroy(fn: GeneralFunc, destruction: DestructionStruct) {
    destruction.v.push(fn)
}
