export function NonTraverse(): never {
    typeError("The given value for for-directive is non-traversable.")
}

export function NotPromise(): never {
    typeError("The given value for await-directive is not a Promise.")
}

export function DuplicateKey(key: string): never {
    typeError("Duplicate key for keyed-for-module, duplicate key: " + key)
}

export function InvalidMountNode(selector: string): never {
    typeError(`The specified mount node could not be found, by selector: ${selector}`)
}

export function ContainerTypeIsBad(attrName: string, tag: string): never {
    typeError(
        `The container for reference attribute(&${attrName}) of <${tag}> tag must be an Array or Set.`
    )
}

export function BadReactivityLevel(level: number): never {
    typeError(
        `Bad reactivity level(${level}), if you don't want the target to be reactive, mark it with stc compiler helper function instead of rea.`
    )
}

function typeError(msg: string): never {
    throw new TypeError(msg)
}
