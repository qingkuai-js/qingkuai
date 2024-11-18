import type {
    ComponentStructure,
    QingKuaiProperties,
    TemplateStuOrModuleFunc,
    QingKuaiComponentConstructonParam
} from "./types"
import { GeneralFunc } from "../util/types"

import { isUndefined } from "../util/shared/assert"
import { IntantiatedByH, nil, noop } from "./constants"
import { arrayFill, len, runAll } from "../util/shared/sundry"
import { destroyBlock, newDestruction } from "../util/runtime/separate"
import { IntantiateComponentManually } from "./message/error"

// 用于存储当前操作的组件实例
let currentInstance: QingKuaiComponent | null = nil

export class QingKuaiComponent {
    /**
     * - ts means Template Structure
     * - deps means all Dependencies of component
     * - dst means Destruction Methods of component
     * - hooks in order: onBeforeMount, onAfterMount,
     *   onBeforeUpdate, onAfterUpdate, onBeforeDestroy, onAfterDestroy
     */
    __: QingKuaiProperties = {
        updating: false,
        ts: [],
        deps: [],
        hooks: [],
        refs: {},
        slots: {},
        props: {},
        ctx: noop,
        context: [],
        dst: newDestruction()
    }

    constructor(args?: QingKuaiComponentConstructonParam, sign?: Symbol) {
        if (sign !== IntantiatedByH) {
            IntantiateComponentManually()
        }
        if (isUndefined(args)) {
            return
        }
        Object.assign(this.__, args)
        setCurrentInstance(this)
    }
}

// 获取当前组件实例（currentInstance）
export function getCurrentInstance() {
    return currentInstance
}

// 设置当前组件实例（到currentInstance）
export function setCurrentInstance(ins: QingKuaiComponent) {
    currentInstance = ins
}

// 通过TemplateStructure实例化组件
export function createComponent(stu: ComponentStructure) {
    const [Component, _, props, refs, ...slots] = stu
    const constructorArg = initComponentConstrctorParam()
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
    return new Component(constructorArg, IntantiatedByH)
}

// 销毁组件
export function destroyComponent(instance: QingKuaiComponent) {
    invokeIndexedHooks(instance, 4)
    destroyBlock(instance.__.dst)
    instance.__ = null as any
    invokeIndexedHooks(instance, 5)
}

// 调用某个组件对应索引下的所有钩子函数，index对应的钩子参见当前文件17-18行
export function invokeIndexedHooks(instance: QingKuaiComponent, index: number) {
    const container = instance.__.hooks[index]
    container && runAll(container)
}

// 初始化一个QingKuaiComponentConstructorParam
function initComponentConstrctorParam(): QingKuaiComponentConstructonParam {
    return { props: {}, refs: {}, slots: {} }
}

// 由于所有声明周期钩子挂载方法相同，此函数批量注册这些方法
function hooksHandlerGen() {
    const ret = arrayFill(6, noop as (fn: GeneralFunc) => void)
    for (let i = 0; i < 6; i++) {
        ret[i] = (fn: GeneralFunc) => {
            const { hooks } = currentInstance!.__
            if (hooks[i]) {
                hooks[i].push(fn)
            } else {
                hooks[i] = [fn]
            }
        }
    }
    return ret
}

export const [
    onBeforeMount,
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
] = hooksHandlerGen()
