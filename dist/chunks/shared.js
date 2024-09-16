const nil = null;
const undef = void 0;
const reflect = Reflect;
const noop = () => {
};
const Wrapper = Symbol("Wrapper");
const IsProxy = Symbol("IsProxy");
const RawValue = Symbol("RawValue");
const IsModuleFunc = Symbol("IsModuleFunc");
const opportunities = ["sync", "pre", "post"];

const EventListenerFlag = {
  once: 1 << 0,
  stop: 1 << 1,
  self: 1 << 2,
  capture: 1 << 3,
  passive: 1 << 4,
  prevent: 1 << 5
};
const EventWrapperFlag = {
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
};
function len(v) {
  return v?.length || 0;
}
function lastElem(arr) {
  return arr[len(arr) - 1];
}
function notEqual(v1, v2) {
  return v1 !== v1 ? v2 === v2 : v1 !== v2;
}
function runAll(fns, ...params) {
  fns.forEach((fn) => fn(...params));
}
function isNull(v) {
  return v === null;
}
function isArray(v) {
  return Array.isArray(v);
}
function isUndefined(v) {
  return v === undef;
}
function isNumber(v) {
  return typeof v === "number";
}
function isString(v) {
  return typeof v === "string";
}
function isBoolean(v) {
  return typeof v === "boolean";
}
function isFunction(v) {
  return typeof v === "function";
}
function isObject(v) {
  return optc(v) === "Object";
}
function toArray(iter) {
  return Array.from(iter);
}
function setArrLength(arr, len2) {
  return arr.length = len2;
}
function values(target) {
  return toArray(target.values());
}
function replaceEachItems(oa, na) {
  const naLen = len(na);
  for (let i = 0; i < naLen; i++) {
    oa[i] = na[i];
  }
  setArrLength(oa, naLen);
}
function entries(target) {
  return toArray(target.entries());
}
function optc(v) {
  return Object.prototype.toString.call(v).slice(8, -1);
}
function arrayFill(len2, init) {
  return Array(len2).fill(init);
}

export { EventWrapperFlag as E, IsProxy as I, RawValue as R, Wrapper as W, isUndefined as a, isArray as b, isNull as c, IsModuleFunc as d, isString as e, entries as f, isNumber as g, arrayFill as h, isFunction as i, replaceEachItems as j, lastElem as k, len as l, noop as m, nil as n, optc as o, runAll as p, EventListenerFlag as q, reflect as r, setArrLength as s, opportunities as t, undef as u, values as v, isObject as w, isBoolean as x, notEqual as y };
