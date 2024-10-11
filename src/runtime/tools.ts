import { Props } from "./constants"
import { isFunction, isUndefined } from "../util/shared/assert"

// 此变量表示最后一个访问props属性的类型，1为普通属性，2为引用传递的属性
// isRef方法和setPropsAccessType方法均基于此变量工作
let lastPropsAccessType = 1

// 调试打印，目前只处理props变量的打印，后续其他特殊值可扩展此方法
// 默认情况下顶部作用域中的props变量不能直接打印出来，因为他是一个代理，并根据访问的属性
// 名称选择从组件实例属性的props或refs中操作指定的属性，使用此方法可打印完整的props对象表达
export function inspect(value: any) {
    const instanceProperties = value?.[Props]

    if (!isUndefined(instanceProperties)) {
        const { props, refs, ctx } = instanceProperties
        value = {}
        for (const key in props) {
            const item = props[key]
            value[key] = isFunction(item) ? item(ctx) : item
        }
        for (const key in refs) {
            value[key] = refs[key][0](ctx)
        }
    }

    console.log(value)
}

// 判断给定props属性值是否是引用传递的
export function isRef() {
    return lastPropsAccessType === 2
}

// 设置顶部作用域中props变量属性访问的类型
export function setPropsAccessType(type: number) {
    lastPropsAccessType = type
}
