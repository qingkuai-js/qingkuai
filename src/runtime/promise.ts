import { NotPromise } from "./message/error"
import { isPromise } from "../util/shared/assert"

const resolvedPromise = Promise.resolve()

// 可取消的Promise包装器
export class CancelablePromise<T> {
    canceled = false

    v!: Promise<T>
    then!: Promise<T>["then"]
    catch!: Promise<T>["catch"]

    constructor(v: any) {
        const self = this
        if (!isPromise(v)) {
            NotPromise()
        }

        const p: Promise<T> = v
        self.v = new Promise<T>((resolve, reject) => {
            p.then(res => {
                !self.canceled && resolve(res)
            }).catch(err => {
                !self.canceled && reject(err)
            })
        })

        self.then = self.v.then.bind(self.v)
        self.catch = self.v.catch.bind(self.v)
    }

    cancel() {
        this.canceled = true
    }
}

export { resolvedPromise }
