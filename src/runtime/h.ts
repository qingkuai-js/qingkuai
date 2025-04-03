import type {
    TopNodes,
    UpdateFunc,
    TopNodesItem,
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
    NIL,
    UNDEF,
    INSTANTIATE_BY_H,
    ALIAS_MODULE_KIND,
    EXPOSE_DESTRUCTIONS,
    IS_WITH_REFERENCE_RET,
    BAD_TARGET_MOUNT_KIND
} from "./constants"
import {
    QingKuaiComponent,
    getCurrentInstance,
    invokeIndexedHooks,
    setCurrentInstance
} from "./instance"
import {
    usedEffectList,
    setUsedEffectList,
    cleanUsedEffectList,
    withCleanUsedEffectList
} from "./reactivity/state"
import {
    mockDirective,
    combineContext,
    extendTopNodes,
    newDestruction,
    getContextFuncGen,
    putTopNodesIntoItem,
    appendChildForDestruction
} from "../util/runtime/separate"
import { BadTarget } from "./message/error"
import { velf } from "../util/runtime/sundry"
import { internalPreEffect } from "./reactivity/effect"
import { len, spliceByElem, values } from "../util/shared/sundry"
import { isComponent, isModuleFunc, isNode } from "../util/runtime/assert"
import { isArray, isFunction, isNull, isNumber } from "../util/shared/assert"
import { text, listen, insert, element, destroy, setText, attribute, textNode } from "./dom"
import { REF_DOM_ATTR } from "../util/shared/constants"

const cachedPureNodes = new Map<number, Node>()

export function render(
    instance: QingKuaiComponent,
    target: Node,
    reference: PartialNode = NIL,
    context: RenderContext[] = [],
    destruction: DestructionStruct | null = NIL
) {
    const properties = instance.__
    const topNodesItem: TopNodesItem = []
    if (isNull(destruction)) {
        if (EXPOSE_DESTRUCTIONS) {
            destruction = properties.dst
        } else {
            destruction = newDestruction()
        }
    }
    properties.ctx = getContextFuncGen(context)
    properties.dst = destruction
    properties.context = context
    setCurrentInstance(instance)

    destruction.v.unshift(() => {
        invokeIndexedHooks(instance, 4)
    })
    destruction.v.push(() => {
        invokeIndexedHooks(instance, 5)
        instance.__ = null as any
    })

    const { ts } = properties
    const preInstance = getCurrentInstance()
    const renderEachTopBlock = (tom: TemplateStuOrModuleFunc) => {
        topNodesItem.push(h(instance, tom, target, reference, true, context, destruction))
    }
    invokeIndexedHooks(instance, 0)
    ts.forEach(renderEachTopBlock)
    invokeIndexedHooks(instance, 1)
    setCurrentInstance(preInstance!)
    return [topNodesItem]
}

export const h = withCleanUsedEffectList(function (
    instance: QingKuaiComponent,
    stu: Node | TemplateStuOrModuleFunc,
    target: Node,
    reference: PartialNode,
    shouldDestroy: boolean,
    context: RenderContext[],
    destruction: DestructionStruct
) {
    let rstu: RenderStructure
    let isInputOrOption = false
    let isInputOrTextarea = false
    let dref: Text | undefined = UNDEF

    if (!isModuleFunc(stu)) {
        rstu = {
            toms: [stu],
            directive: NIL
        }
    } else {
        rstu = stu(getContextFuncGen(context))
    }

    const topNodes: TopNodes = []
    const { directive, toms } = rstu
    const times = directive?.v[0] ?? 1
    const parentDestruction = destruction
    const isDirectiveModule = !isNull(directive)
    const isAliasModule = directive?.t === ALIAS_MODULE_KIND

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
            attachDestroyLocal(() => destroy(dref!))
            insert(target, dref, reference), (reference = dref)
        }

        for (let i = 0; i < times; i++) {
            appendChildForDestruction(destruction)
        }

        const moduleUpdateFn = directive.v[2](
            instance,
            directive,
            target,
            dref!,
            context,
            destruction,
            topNodes
        )
        if (moduleUpdateFn && !isAliasModule) {
            setUsedEffectList(directive.e)
            attachUpdateLocal(moduleUpdateFn)
            cleanUsedEffectList()
        }
    }

    for (let i = 0; i < times; i++) {
        if (isDirectiveModule) {
            destruction = parentDestruction.c[i]
        }

        const topNodesItem = extendTopNodes(topNodes)
        attachDestroyLocal(() => {
            spliceByElem(topNodes, topNodesItem)
        })

        const extendTopNodesItemLocal = (topNodes: TopNodes) => {
            putTopNodesIntoItem(topNodesItem, topNodes)
        }

        toms.forEach(tom => {
            const currentContext = combineContext(directive, context, i)
            if (isNode(tom)) {
                topNodesItem.push(tom)
                insert(target, tom, reference)
                attachDestroyLocal(() => destroy(tom))
                return
            }

            // rstu是子指令模块
            if (isModuleFunc(tom)) {
                return extendTopNodesItemLocal(
                    h(instance, tom, target, reference, shouldDestroy, currentContext, destruction)
                )
            }

            const [tag, content, attrs, events, ...children] = tom
            const cif = isFunction(content)
            const qkNode: QingKuaiNodeStruct = { n: NIL, text: "", attrs: {} }
            const cacheId = isNumber(children[0]) ? children[0] : isNumber(tag) ? tag : -1

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

            // 子组件，此时tag是组件标识符（或组件getter）
            if (isFunction(tag)) {
                const componentStu = tom as ComponentStructure
                const component = isComponent(tag) ? tag : getValue(tag)

                // @ts-ignore
                const componentInstance = createComponent([component, ...componentStu.slice(1)])
                return extendTopNodesItemLocal(
                    render(componentInstance, target, reference, context, destruction)
                )
            }

            // 组件slot，此时content是插槽名称，attrs是参数列表，children是默认模板结构
            if ((cleanUsedEffectList(), tag === "slot")) {
                let slot = instance.__.slots[content as string]

                const attrsLen = len(attrs)
                const slotArgs: AnyObject = {}

                // 获取slot传递的参数
                const updateSlotContext = () => {
                    for (let i = 0; i < attrsLen; i += 2) {
                        slotArgs[attrs![i]] = getValue(attrs![i + 1])
                    }
                }

                // 编译器不会为组件和slot标签添加cache id，此处可以正常处理children
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
                attachDestroyLocal(internalPreEffect(updateSlotContext, effectList))

                // 渲染slot中的内容
                return slot.forEach(tom => {
                    extendTopNodesItemLocal(
                        h(instance, tom, target, reference, shouldDestroy, slotContext, destruction)
                    )
                })
            }

            // 创建节点及处理textContent
            if (cachedPureNodes.has(cacheId)) {
                qkNode.n = cachedPureNodes.get(cacheId)!
            } else {
                if (!tag) {
                    text(qkNode, getValue(content), cif)
                } else {
                    element(qkNode, tag as string)
                    setText(qkNode, getValue(content), cif)

                    // 判断元素是否为input、textarea或option，它们需要特殊处理：
                    // 1. input和textarea元素的input事件需要避免在输入法合成阶段触发
                    // 2. input和option元素的value属性无论是否是getter都需要被记录
                    const isInput = tag === "input"
                    isInputOrOption = isInput || tag === "option"
                    isInputOrTextarea = isInput || tag === "textarea"
                }
                cacheId !== -1 && cachedPureNodes.set(cacheId, qkNode.n!)
            }

            // 如果是option元素，把qkNode添加到DOM属性中，在处理select的引用
            // value属性值时，需要用到option元素的qkNode来调用attribute方法
            if (tag === "option") {
                ;(qkNode.n as any)["_qkNode"] = qkNode
            }

            if (shouldDestroy || isDirectiveModule) {
                attachDestroyLocal(() => destroy(qkNode.n!))
            }
            if (cif) {
                attachUpdateLocal(() => {
                    return setText(qkNode, invokeGetter(content), true)
                })
            }
            insert(target, qkNode.n!, reference)
            topNodesItem.push(qkNode.n!)

            // 处理attributes
            for (let i = 0; i < len(attrs); i += 2) {
                let [key, value] = [attrs![i], attrs![i + 1]]
                if (key === REF_DOM_ATTR) {
                    value(qkNode.n)
                    continue
                }

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

            if (tag && !isNumber(tag) && tag !== "!") {
                attribute(qkNode, "qk-" + instance.__.id, "", false)
            }

            // 处理events
            for (let i = 0; i < len(events); i += 3) {
                let eventHandler: EventListener
                const stu = events!.slice(i, i + 3) as EventStructure
                const [eventName, eventHandlerGetter, eventFlag] = stu

                // 判断是否是withReference方法的返回值，如果是的话则需要先调用它，它会返回真正的
                // NormalEventHandlerGetter，调用时它会设置属性的初始值并将修改属性值的方法记录到
                // 依赖的响应性变量的effect中（这一操作同上attribute处理部分，但这样做可以有效压缩生成代码体积）
                if (!eventHandlerGetter[IS_WITH_REFERENCE_RET]) {
                    eventHandler = invokeGetter(eventHandlerGetter)
                } else {
                    eventHandler = eventHandlerGetter(qkNode, invokeGetter, attachUpdateLocal)
                }

                // 将事件监听的销毁方法添加到destruction：移除节点时销毁事件监听处理器
                const listenLocal = (eventName: string, eventHandler: EventListener) => {
                    attachDestroyLocal(listen(qkNode.n!, eventName, eventHandler, eventFlag))
                }

                // 默认情况下输入合成阶段（如汉语拼音输入法合成过程中，即未选定输入前）不会触发input事件
                // 如果为input事件传入了compose修饰符，则会在合成阶段触发input事件，下面的代码就针对这种
                // 情况进行了处理。需要注意的是：在compositionend事件中调用了一次原始的input事件处理器，
                // 因为在浏览器的默认行为中，选定输入的那一刻(通常为按下上方主键盘数字键或空格键选定)也被
                // 算在合成过程中，而这里的处理将选定输入的操作排除在合成过程之外
                if (!isInputOrTextarea || eventName !== "input" || velf(eventFlag, "compose")) {
                    listenLocal(eventName, eventHandler)
                } else {
                    listenLocal("compositionend", eventHandler)
                    listenLocal(eventName, event => {
                        if (!(event as InputEvent).isComposing) {
                            eventHandler(event)
                        }
                    })
                }
            }

            // 处理子节点
            for (const child of children.slice(+(cacheId !== -1))) {
                const assertedChild = child as TemplateStuOrModuleFunc
                h(instance, assertedChild, qkNode.n!, NIL, false, currentContext, destruction)
            }
        })
    }

    return dref && topNodes.push([dref]), topNodes
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
    if (target) {
        // @ts-ignore
        const app = new Component({
            ...options,
            sign: INSTANTIATE_BY_H
        })
        return render(app, target), app
    } else {
        BadTarget(selector, BAD_TARGET_MOUNT_KIND)
    }
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

function createComponent(stu: ComponentStructure) {
    const [Component, _, props, refs, ...slots] = stu
    const constructorArg: QingKuaiComponentConstructonParam = {
        props: {},
        refs: {},
        slots: {}
    }
    if (props) {
        for (let i = 0; i < len(props); i += 2) {
            constructorArg.props[props[i]] = props[i + 1]
        }
    }
    if (refs) {
        for (let i = 0; i < len(refs); i += 2) {
            constructorArg.refs[refs[i]] = [refs[i + 1][0], refs[i + 1][1]]
        }
    }
    if (slots) {
        for (let i = 0; i < len(slots); i++) {
            const stus = slots[i].slice(1) as TemplateStuOrModuleFunc[]
            constructorArg.slots[slots[i][0]] = stus
        }
    }
    return new Component({ ...constructorArg, sign: INSTANTIATE_BY_H })
}
