// 事件监听器flag
export const EventListenerFlag = {
    once: 1 << 0,
    stop: 1 << 1,
    self: 1 << 2,
    capture: 1 << 3,
    passive: 1 << 4,
    prevent: 1 << 5,
    compose: 1 << 6
}

// 事件包装器flag
export const EventWrapperFlag = {
    enter: 1 << 0,
    tab: 1 << 1,
    del: 1 << 2,
    esc: 1 << 3,
    up: 1 << 4,
    down: 1 << 5,
    left: 1 << 6,
    right: 1 << 7,
    space: 1 << 8,

    meta: 1 << 9,
    alt: 1 << 10,
    ctrl: 1 << 11,
    shift: 1 << 12
}

export const PositionFlag = {
    isScript: 1 << 0,
    isSlotAttrEndQuote: 1 << 1,
    isSlotAttrStartQuote: 1 << 2
}
