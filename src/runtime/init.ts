import type { AnyObject } from "../util/types"
import type { QingKuaiComponent } from "./instance"
import type { TemplateStuOrModuleFunc } from "./types"

import { RawValue, undef } from "./constants"
import { isFunction } from "../util/shared/assert"
import { AssignmentToProps } from "./message/warn"

// 获取已绑定组件实例的相关方法
export function init(instance: QingKuaiComponent, hashId: string) {
    const properties = instance.__
    const { props, refs, ctx } = properties as any
    properties.id = hashId

    // 获取refs的原始值表示（可阅读形式）
    const getRawRefs = () => {
        return Object.keys(refs).reduce((p, c) => {
            return { ...p, [c]: refs[c][0](ctx) }
        }, {} as AnyObject)
    }

    // 获取props的原始值表示（可阅读形式）
    const getRawProps = () => {
        return Object.keys(props).reduce((p, c) => {
            const v = props[c]
            const vf = isFunction(v) // whether Value is Function
            return { ...p, [c]: vf ? v(ctx) : v }
        }, {} as AnyObject)
    }

    return {
        // sts: Set Component Template Structure
        scts(ts: TemplateStuOrModuleFunc[]) {
            properties.ts = ts
        },

        // 编译器生成的init调用会将props和refs解构声明到组件构造函数的顶部作用域
        props: new Proxy(
            {},
            {
                get(_, property) {
                    if (property === RawValue) {
                        return getRawProps()
                    }

                    const v = props[property]
                    return isFunction(v) ? v(ctx) : v
                },
                set() {
                    return AssignmentToProps(), true
                }
            }
        ),

        refs: new Proxy(
            {},
            {
                get(_, property) {
                    if (property === RawValue) {
                        return getRawRefs()
                    }
                    if (!(property in refs)) {
                        return undef
                    }
                    return refs[property][0](ctx)
                },
                set(_, property, value) {
                    if (property in refs) {
                        refs[property][1](value, ctx)
                    }
                    return true
                }
            }
        )
    }
}
