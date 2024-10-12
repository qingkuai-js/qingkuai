import type { QingKuaiComponent } from "./instance"
import type { TemplateStuOrModuleFunc, PGetHandler, PSetHandler } from "./types"

import { Props, undef } from "./constants"
import { setPropsAccessType } from "./tools"
import { isFunction } from "../util/shared/assert"
import { AssignmentToProps } from "./message/warn"
import { AssignToUndefined } from "./message/error"

// 获取已绑定组件实例的相关方法
export function init(instance: QingKuaiComponent) {
    const properties = instance.__
    const { props, refs, ctx } = properties as any
    return {
        // sts: Set Component Template Structure
        scts(ts: TemplateStuOrModuleFunc[]) {
            properties.ts = ts
        },

        // 调用init方法后此属性会被解构声明到组件构造函数的顶部作用域，访问props的属性时，会依次从组件实例属性中的
        // props和refs中获取（编译器限制两者中的属性不能重名），修改属性时，只有refs中的属性值能被修改（通过setter），
        // 而修改props中的属性将发出警告，如果props和refs中均不存在指定名称的属性，将抛出错误（不能为undefined赋值）
        props: new Proxy(
            {},
            {
                get(_, property) {
                    if (property === Props) {
                        return properties
                    }
                    if (property in refs) {
                        setPropsAccessType(2)
                        return refs[property][0](ctx)
                    } else if (property in props) {
                        const item = props[property]
                        setPropsAccessType(1)
                        return isFunction(item) ? item(ctx) : item
                    }
                    return undef
                },
                set(_, property, value) {
                    if (property in props) {
                        AssignmentToProps()
                    } else if (property in refs) {
                        refs[property][1](value, ctx)
                    } else {
                        AssignToUndefined(property)
                    }
                    return true
                }
            }
        )
    }
}
