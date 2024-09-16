import { I as IsProxy, E as EventWrapperFlag, g as isNumber, l as len, i as isFunction, n as nil, d as IsModuleFunc, q as EventListenerFlag, m as noop, p as runAll, h as arrayFill, t as opportunities, v as values, c as isNull, o as optc, w as isObject, x as isBoolean, b as isArray, k as lastElem, R as RawValue, a as isUndefined, W as Wrapper, r as reflect, u as undef, y as notEqual } from './shared.js';

const usedEffectList = /* @__PURE__ */ new Set();
const asyncWatchEffectList = /* @__PURE__ */ new Set();
function clearUsedEffectList() {
  usedEffectList.clear();
}
function setUsedEffectList(lists) {
  lists.forEach((list) => {
    usedEffectList.add(list);
  });
}
function withCleanUsedEffectList(fn) {
  const funcWithCleanEffect = (...args) => {
    clearUsedEffectList();
    return fn(...args);
  };
  return funcWithCleanEffect;
}

function isReactive(v) {
  return v?.[IsProxy] === true;
}
function isNode(v) {
  return isNumber(v.nodeType);
}
function isModuleFunc(v) {
  return !!v?.[IsModuleFunc];
}
function velf(flag, key) {
  return !!(EventListenerFlag[key] & flag);
}
function vewf(flag, key) {
  return !!(EventWrapperFlag[key] & flag);
}
function spliceByElem(arr, elem) {
  const index = arr.indexOf(elem);
  if (index !== -1) {
    arr.splice(index, 1);
  }
}
function newDestruction() {
  return {
    v: [],
    c: /* @__PURE__ */ new Set()
  };
}
function mockDirective(contextValues, effectList) {
  return {
    t: 0,
    e: effectList || [],
    v: [0, contextValues, noop]
  };
}
function extendNks(nks, nki) {
  if (len(nki) !== 1) {
    nks.push(nki);
  } else {
    nki[0].nks.forEach((nk) => {
      nks.push(nk);
    });
  }
}
function destroyBlock(destruction) {
  runAll(destruction.v);
  destruction.c.forEach((child) => {
    child.forEach((dst) => {
      destroyBlock(dst);
    });
  });
}
function combineContext(directive, context, index) {
  const dv = directive?.v[1][index];
  if (!dv || !len(dv)) {
    return context;
  }
  return context.concat({
    v: dv,
    e: directive.e
  });
}
function getContextFuncGen(context, node = nil) {
  return (p) => {
    if (isNumber(p)) {
      for (let i = 0; true; i++) {
        const cur = context[i];
        const curvLen = len(cur.v);
        if (p < curvLen) {
          setUsedEffectList(cur.e);
          return cur.v[p];
        } else {
          p = p - curvLen;
        }
      }
    } else if (isFunction(p)) {
      return p.bind(node);
    }
  };
}

let currentInstance = nil;
class QingKuaiComponent {
  /**
   * - ts means Template Structure
   * - deps means all Dependencies of component
   * - dst means Destruction Methods of component
   * - hooks in order: onBeforeMount, onAfterMount,
   *   onBeforeUpdate, onAfterUpdate, onBeforeDestroy, onAfterDestroy
   */
  __ = {
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
  };
  constructor(args) {
    const { __: properties } = this;
    const { slots, refs, props } = args;
    properties.refs = refs;
    properties.slots = slots;
    properties.props = props;
    setCurrentInstance(this);
  }
}
function getCurrentInstance() {
  return currentInstance;
}
function setCurrentInstance(ins) {
  currentInstance = ins;
}
function createComponent(stu) {
  const [Component, _, props, refs, ...slots] = stu;
  const constructorArg = initComponentConstrctorParam();
  if (props) {
    for (let i = 0; i < len(props); i += 2) {
      constructorArg.props[props[i]] = props[i + 1];
    }
  }
  if (refs) {
    for (let i = 0; i < len(refs); i += 2) {
      constructorArg.refs[refs[i]] = [refs[i + 1][0], refs[i + 1][1]];
    }
  }
  if (slots) {
    for (let i = 0; i < len(slots); i++) {
      const stus = slots[i].slice(1);
      constructorArg.slots[slots[i][0]] = stus;
    }
  }
  return new Component(constructorArg);
}
function invokeIndexedHooks(instance, index) {
  const container = instance.__.hooks[index];
  container && runAll(container);
}
function initComponentConstrctorParam() {
  return { props: {}, refs: {}, slots: {} };
}
function hooksHandlerGen() {
  const ret = arrayFill(6, noop);
  for (let i = 0; i < 6; i++) {
    ret[i] = (fn) => {
      const { hooks } = currentInstance.__;
      if (hooks[i]) {
        hooks[i].push(fn);
      } else {
        hooks[i] = [fn];
      }
    };
  }
  return ret;
}
const [
  onBeforeMount,
  onAfterMount,
  onBeforeUpdate,
  onAfterUpdate,
  onBeforeDestroy,
  onAfterDestroy
] = hooksHandlerGen();

function AssignmentToProps() {
  warn("An assignment to a unbound component prop is invalid, this operation has been ignored.");
}
function AssignmentToDerived() {
  warn("An assignment to derived reacativity state is invalid, this operation has been ignored.");
}
function WatchEffectDependenNoReactiveValue(funcName, isEffect = false) {
  const postfix = isEffect ? " again" : "";
  const desc = isEffect ? "callback" : "watch target";
  warn(
    `The ${desc} of [${funcName}] call not dependen any reactive value, and it will be never executed${postfix}.`
  );
}
function DerivedDependenNoReactiveValue() {
  warn(
    "The derived reactivity state declaration does not dependen any reactive value, consider replacing it to a normal declaration statement."
  );
}
function warn(msg) {
  console.warn(msg);
}

function runSyncEffect(list) {
  list?.forEach((item) => {
    if (item.type === "sync") {
      runWatchEffect(item);
    } else {
      asyncWatchEffectList.add(item);
    }
  });
}
function flushWatchEffect(type) {
  asyncWatchEffectList.forEach((item) => {
    if (item.type === type) {
      runWatchEffect(item);
      asyncWatchEffectList.delete(item);
    }
  });
}
function runWatchEffect(stu) {
  const isWatch = isWatchStruct(stu);
  if (!isWatch) {
    stu.fn();
  } else {
    const value = stu.getter();
    if (stu.pre === value) {
      return;
    }
    stu.fn(stu.pre = stu.cur, stu.cur = value);
  }
}
function isWatchStruct(stu) {
  return "pre" in stu;
}
function createWatchEffect(effectList, stu) {
  effectList.forEach((item) => {
    if (isNull(item[1])) {
      item[1] = /* @__PURE__ */ new Set();
    }
    item[1].add(stu);
  });
  return () => {
    effectList.forEach((item) => {
      item[1].delete(stu);
      if (item[1].size === 0) {
        item[1] = nil;
      }
    });
  };
}
function initWatch(getter, fn, type) {
  const value = getter();
  const effectList = values(usedEffectList);
  const watchStruct = {
    fn,
    type,
    getter,
    pre: value,
    cur: value
  };
  if (len(effectList) === 0) {
    const funcName = type === "post" ? "watch" : type + "Watch";
    WatchEffectDependenNoReactiveValue(funcName, false);
  }
  return createWatchEffect(effectList, watchStruct);
}
function initEffect(fn, type, initEffectList) {
  let effectList;
  const isRuntime = isNull(initEffectList);
  const reactiveRunStruct = {
    fn,
    type
  };
  if (initEffectList) {
    effectList = initEffectList;
  } else {
    fn();
    effectList = values(usedEffectList);
  }
  if (isRuntime && len(effectList) === 0) {
    const funcName = type === "post" ? "effect" : type + "Effect";
    WatchEffectDependenNoReactiveValue(funcName, true);
  }
  return createWatchEffect(effectList, reactiveRunStruct);
}
function watchFuncGen(type) {
  return (target, callback) => {
    return initWatch(target, callback, type);
  };
}
function runtimeEffectFuncGen(type) {
  return (callback) => {
    return initEffect(callback, type, nil);
  };
}
function internalEffectFuncGen(type) {
  return (callback, initEffectList) => {
    return initEffect(callback, type, initEffectList);
  };
}
const [
  [syncWatch, preWatch, watch],
  [syncEffect, preEffect, effect],
  [internalSyncEffect, internalPreEffect, internalEffect]
] = [watchFuncGen, runtimeEffectFuncGen, internalEffectFuncGen].map((generator) => {
  return opportunities.map((opportunity) => generator(opportunity));
});

function NonTraverse() {
  typeError("The given value for for-directive is non-traversable.");
}
function NotPromise() {
  typeError("The given value for await-directive is not a Promise.");
}
function DuplicateKey(key) {
  typeError("Duplicate key for keyed-for-module, duplicate key: " + key);
}
function InvalidMountNode(selector) {
  typeError(`The specified mount node could not be found, by selector: ${selector}`);
}
function BadReactivityLevel(level) {
  typeError(
    `Bad reactivity level(${level}), if you don't want the target to be reactive, mark it with stc compiler helper function instead of rea.`
  );
}
function typeError(msg) {
  throw new TypeError(msg);
}

const resolvedPromise = Promise.resolve();
class CancelablePromise {
  canceled = false;
  v;
  then;
  catch;
  constructor(v) {
    const self = this;
    if (optc(v) !== "Promise") {
      NotPromise();
    }
    const p = v;
    self.v = new Promise((resolve, reject) => {
      p.then((res) => {
        !self.canceled && resolve(res);
      }).catch((err) => {
        !self.canceled && reject(err);
      });
    });
    self.then = self.v.then.bind(self.v);
    self.catch = self.v.catch.bind(self.v);
  }
  cancel() {
    this.canceled = true;
  }
}

let updateLock = false;
const updateList = /* @__PURE__ */ new Set();
function scheduleUpdate(item) {
  updateList.add(item);
  if (updateLock) {
    return;
  }
  resolvedPromise.then(function update() {
    const calledFuncs = [];
    const updatingComponents = /* @__PURE__ */ new Set();
    flushWatchEffect("pre");
    updateList.forEach((list) => {
      list.forEach((fn) => {
        const component = fn.instance;
        const properties = component.__;
        if (isNull(properties)) {
          return list.delete(fn);
        }
        if (!fn.called) {
          const componentIsUpdating = updatingComponents.has(component);
          if (fn() && properties && !componentIsUpdating) {
            invokeIndexedHooks(component, 2);
            updatingComponents.add(component);
          }
          calledFuncs.push(fn);
          fn.called = true;
        }
      });
      updateList.delete(list);
    });
    flushWatchEffect("post");
    calledFuncs.forEach((fn) => {
      fn.called = false;
    });
    updatingComponents.forEach((component) => {
      invokeIndexedHooks(component, 3);
      updatingComponents.delete(component);
    });
    updateLock = false;
  });
  updateLock = true;
}
function nextTick(fn) {
  return resolvedPromise.then(fn || noop);
}

function destroy(node) {
  node.parentNode.removeChild(node);
}
function textNode(content) {
  return document.createTextNode(content);
}
function element(qknode, tag) {
  qknode.n = document.createElement(tag);
}
function insert(target, node, reference) {
  target.insertBefore(node, reference);
}
function text(qknode, content, record) {
  content = "" + content;
  if (record) {
    qknode.text = content;
  }
  qknode.n = textNode("" + content);
}
function setText(qknode, content, record) {
  content = "" + content;
  if (qknode.text === content) {
    return false;
  }
  if (record) {
    qknode.text = content;
  }
  return qknode.n.textContent = "" + content, true;
}
function attribute(qknode, key, value, record) {
  const { attrs } = qknode;
  const isBool = isBoolean(value);
  const elem = qknode.n;
  const isClass = key === "class";
  const toStr = !isBool && !isClass;
  if (toStr) {
    value = "" + value;
  } else if (isClass) {
    value = transformClassName(value);
  }
  if (attrs[key] === value) {
    return false;
  }
  if (record) {
    attrs[key] = value;
  }
  if (key === "style") {
    elem.style.cssText = value;
  } else if (isBool && !value) {
    elem.removeAttribute(key);
  } else if (key in elem) {
    nextTick(() => elem[key] = value);
  } else {
    elem.setAttribute(key, isBool ? "" : value);
  }
  return true;
}
function listen(node, key, handler, flag) {
  const useStop = velf(flag, "stop");
  const useSelf = velf(flag, "self");
  const usePrevent = velf(flag, "prevent");
  const useWrapper = useStop || usePrevent || useSelf;
  const wrapper = function(evt) {
    if (!useSelf || evt.target === this) {
      handler.call(this, evt);
      useStop && evt.stopPropagation();
      usePrevent && evt.preventDefault();
    }
  };
  node.addEventListener(key, useWrapper ? wrapper : handler, {
    once: velf(flag, "once"),
    capture: velf(flag, "capture"),
    passive: velf(flag, "passive")
  });
  return () => node.removeEventListener(key, handler);
}
function transformClassName(value) {
  const valueArr = [];
  const valueIsArray = isArray(value);
  const transformObject = (obj) => {
    Object.keys(obj).forEach((key) => {
      if (obj[key]) {
        valueArr.push(key);
      }
    });
  };
  const transformArray = (arr) => {
    for (const item of arr) {
      if (isArray(item)) {
        transformArray(item);
      } else if (isObject(item)) {
        transformObject(item);
      } else {
        valueArr.push("" + item);
      }
    }
  };
  if (!valueIsArray && !isObject(value)) {
    return value;
  }
  if (valueIsArray) {
    transformArray(value);
  } else {
    transformObject(value);
  }
  return valueArr.join(" ").replace(/\s+/g, " ");
}

function render(instance, target, reference = nil, context = [], isKeyedTop = false) {
  let dst;
  const properties = instance.__;
  dst = properties.dst;
  properties.context = context;
  properties.ctx = getContextFuncGen(context);
  setCurrentInstance(instance);
  const ts = properties.ts;
  const preInstance = getCurrentInstance();
  const keyedInfo = [{ nks: [], dst }];
  const renderEachTopBlock = (stu) => {
    const nki = h(
      instance,
      stu,
      target,
      reference,
      true,
      context,
      dst,
      isKeyedTop
    );
    extendNks(keyedInfo[0].nks, nki);
  };
  invokeIndexedHooks(instance, 0);
  ts.forEach(renderEachTopBlock);
  invokeIndexedHooks(instance, 1);
  setCurrentInstance(preInstance);
  return [keyedInfo, dst];
}
const h = withCleanUsedEffectList(function(instance, stu, target, reference, shouldDestroy, context, destruction, isKeyedTop = false) {
  let dref;
  const { directive, toms } = toRenderStructure(stu, context);
  const isKeyedForModule = directive && directive.t === 1;
  const isAliasModule = directive && directive.t === 2;
  const destructionArr = [];
  const isDirectiveModule = !isNull(directive);
  const times = directive?.v[0] ?? 1;
  const keyedInfo = [];
  const selfAttachUpdate = (fn) => {
    attachUpdate(fn, instance, destruction);
  };
  const selfAttachDestroy = (fn) => {
    attachDestroy(fn, destruction);
  };
  if (isDirectiveModule) {
    if (!isAliasModule) {
      dref = textNode("");
      insert(target, dref, reference);
      isKeyedTop ||= directive.t === 1;
      selfAttachDestroy(() => destroy(dref));
    }
    for (let i = 0; i < times; i++) {
      extendDsts(destructionArr);
    }
    destruction.c.add(destructionArr);
    const moduleUpdateFn = directive.v[2](
      instance,
      directive,
      target,
      dref,
      context,
      destruction,
      destructionArr,
      isKeyedTop,
      keyedInfo
    );
    if (moduleUpdateFn && !isAliasModule) {
      setUsedEffectList(directive.e);
      selfAttachUpdate(moduleUpdateFn);
      clearUsedEffectList();
    }
  }
  for (let i = 0; i < times; i++) {
    if (isDirectiveModule) {
      destruction = destructionArr[i];
    }
    keyedInfo.push({
      nks: [],
      dst: isKeyedForModule ? destruction || nil : nil
    });
    toms.forEach((tom) => {
      const qkNode = { n: nil, text: "", attrs: {} };
      const [tag, content, attrs, events, ...children] = tom.template;
      const currentContext = combineContext(directive, context, i);
      const currentKeyedInfo = lastElem(keyedInfo);
      const cif = isFunction(content);
      const invokeGetter = (getter) => {
        return getter(getContextFuncGen(currentContext, qkNode.n));
      };
      const getValue = (getter) => {
        if (!isFunction(getter)) {
          return getter;
        }
        return invokeGetter(getter);
      };
      if (isFunction(tag)) {
        const componentStu = tom.template;
        const component = createComponent(componentStu);
        const [nki, dst] = render(
          component,
          target,
          reference,
          context,
          isKeyedTop
        );
        shouldDestroy && destruction.c.add([dst]);
        extendNks(currentKeyedInfo.nks, nki);
        return;
      }
      if (tom.module) {
        const cki = h(
          instance,
          tom.module,
          target,
          dref || reference,
          shouldDestroy,
          currentContext,
          destruction,
          isKeyedTop
        );
        if (isKeyedTop) {
          extendNks(currentKeyedInfo.nks, cki);
        }
        return;
      }
      if (tag === "slot") {
        let slot = instance.__.slots[content];
        const attrsLen = len(attrs);
        const slotArgs = {};
        const updateSlotContext = () => {
          for (let i2 = 0; i2 < attrsLen; i2 += 2) {
            slotArgs[attrs[i2]] = invokeGetter(attrs[i2 + 1]);
          }
        };
        if (!slot) {
          slot = children;
        }
        if (!isArray(slot[0])) {
          slot = [slot];
        }
        updateSlotContext();
        const effectList = values(usedEffectList);
        const md = mockDirective([[slotArgs]], effectList);
        const slotContext = combineContext(md, context, 0);
        const unsetEffect = internalPreEffect(updateSlotContext, effectList);
        attachDestroy(unsetEffect, destruction);
        slot.forEach((tom2) => {
          const nki = h(
            instance,
            tom2,
            target,
            reference,
            shouldDestroy,
            slotContext,
            destruction,
            isKeyedTop
          );
          if (isKeyedTop) {
            extendNks(currentKeyedInfo.nks, nki);
          }
        });
        return;
      }
      if (tag) {
        element(qkNode, tag);
        setText(qkNode, getValue(content), cif);
      } else {
        text(qkNode, getValue(content), cif);
      }
      if (isKeyedTop) {
        currentKeyedInfo.nks.push(qkNode.n);
      }
      if (shouldDestroy || isDirectiveModule) {
        selfAttachDestroy(() => destroy(qkNode.n));
      }
      if (cif) {
        selfAttachUpdate(() => {
          return setText(qkNode, invokeGetter(content), true);
        });
      }
      insert(target, qkNode.n, dref || reference);
      if (attrs) {
        for (let i2 = 0; i2 < len(attrs); i2 += 2) {
          let [key, value] = [attrs[i2], attrs[i2 + 1]];
          const attrValueIsFunction = isFunction(value);
          attribute(
            qkNode,
            key,
            getValue(value),
            attrValueIsFunction
          );
          if (attrValueIsFunction) {
            selfAttachUpdate(() => {
              return attribute(qkNode, key, invokeGetter(value), true);
            });
          }
        }
      }
      if (events) {
        for (let i2 = 0; i2 < len(events); i2 += 3) {
          const [key, value, flag] = events.slice(i2, i2 + 3);
          selfAttachDestroy(listen(qkNode.n, key, invokeGetter(value), flag));
        }
      }
      for (const child of children) {
        const assertedChild = child;
        h(instance, assertedChild, qkNode.n, nil, false, currentContext, destruction);
      }
    });
  }
  if (isDirectiveModule && isKeyedTop && !isAliasModule) {
    keyedInfo.push({ nks: [dref], dst: nil });
  }
  return keyedInfo;
});
function createApp(Component, options = {}) {
  ["props", "refs", "slots"].forEach((key) => {
    if (!options[key]) {
      options[key] = {};
    }
  });
  return {
    mount: (selector) => {
      const target = document.querySelector(selector);
      if (!target) {
        InvalidMountNode(selector);
      } else {
        const app = new Component(options);
        render(app, target);
        return app;
      }
    }
  };
}
function extendDsts(dsts) {
  const ret = newDestruction();
  dsts.push(ret);
  return ret;
}
function toRenderStructure(stus, context = [], directive = nil) {
  let ret = {
    toms: [],
    directive: nil
  };
  if (!isArray(stus) || !isModuleFunc(stus[0]) && !isArray(stus[0])) {
    stus = [stus];
  }
  stus.forEach((stu) => {
    const stuIsModuleFunc = isModuleFunc(stu);
    if (isNull(directive) && stuIsModuleFunc) {
      ret = stu(getContextFuncGen(context), context);
    } else {
      ret.directive = directive;
      if (stuIsModuleFunc) {
        ret.toms.push({
          module: stu,
          template: []
        });
      } else {
        ret.toms.push({
          module: nil,
          template: stu
        });
      }
    }
  });
  return ret;
}
function attachUpdate(fn, instance, destrcution) {
  fn.instance = instance;
  usedEffectList.forEach(([list]) => {
    list.add(fn);
    attachDestroy(() => list.delete(fn), destrcution);
  });
  clearUsedEffectList();
}
function attachDestroy(fn, destruction) {
  destruction.v.push(fn);
}

const react = reactGen();
const constReact = reactGen(1);
const destructuringReact = destructuringReactGen();
const constDestructuringReact = destructuringReactGen(true);
class ReactivityWrapper {
  constructor(raw2, level, typeFlag, debugSetter, initEffect) {
    this.raw = raw2;
    this.level = level;
    this.typeFlag = typeFlag;
    this.debugSetter = debugSetter;
    this.proxy = new Proxy(raw2, this);
    this.effect = initEffect || [/* @__PURE__ */ new Set(), nil];
  }
  get = (target, property, receiver) => {
    if (property === IsProxy) {
      return true;
    }
    if (property === Wrapper) {
      return this;
    }
    if (property === RawValue) {
      return this.raw;
    }
    const { effect, typeFlag, level } = this;
    const propValue = reflect.get(target, property, receiver);
    const reactAgain = (nextTarget) => {
      return react(nextTarget, level - 1, effect);
    };
    usedEffectList.add(effect);
    if (typeFlag & 6) {
      if (!isFunction(propValue)) {
        return propValue;
      }
      return (...args) => {
        const getRet = () => {
          return target[property](...args);
        };
        if (property === "forEach") {
          const [oriCallback, thisArg] = args;
          return target[property]((ck, cv, cs) => {
            oriCallback(reactAgain(ck), reactAgain(cv), cs);
          }, thisArg);
        }
        if (property === "keys" || property === "values" || property === "entries") {
          const iterator = getRet();
          const oriIteratorNext = iterator.next;
          iterator.next = () => {
            const nextRet = oriIteratorNext.call(iterator);
            if (!nextRet.done) {
              nextRet.value = reactAgain(nextRet.value);
            }
            return nextRet;
          };
          return iterator;
        }
        const [key, value] = args;
        const oriSize = target.size;
        const isSet = !(typeFlag & 4);
        const isMapSet = !isSet && property === "set";
        const preValue = isMapSet ? target.get(key) : undef;
        const valueChanged = isMapSet && notEqual(preValue, value);
        if (property === "clear" || property === "delete" || property === (isSet ? "add" : "set")) {
          if (target.size !== oriSize || valueChanged) {
            processEffect(effect);
          }
        }
        return getRet();
      };
    }
    return reactAgain(propValue);
  };
  set = (target, property, value, receiver) => {
    const { debugSetter, effect } = this;
    if (notEqual(target[property], value)) {
      if (debugSetter !== noop) {
        debugSetter(value);
      }
      const ret = reflect.set(
        target,
        property,
        value,
        receiver
      );
      return processEffect(effect), ret;
    }
    return true;
  };
  deleteProperty = (target, property) => {
    processEffect(this.effect);
    return reflect.deleteProperty(target, property);
  };
}
function raw(v) {
  return isReactive(v) ? v[RawValue] : v;
}
function reactGen(levelDown = 0) {
  return (target, los, eol) => {
    let level = Infinity;
    let debugSetter = noop;
    let effect = undef;
    const isDebug = isFunction(los);
    const eolIsNumber = isNumber(eol);
    const eolIsUndefined = isUndefined(eol);
    const isDeclaration = isDebug || eolIsNumber || eolIsUndefined;
    if (isDeclaration) {
      if (!isDebug) {
        if (!isUndefined(los)) {
          level = los;
        }
      } else {
        debugSetter = los;
        if (!eolIsUndefined) {
          level = eol;
        }
      }
      if (level - levelDown < 0) {
        BadReactivityLevel(level);
      }
      level -= levelDown;
      if (isReactive(target)) {
        target = target[RawValue];
      }
      target = {
        $: target
      };
    } else {
      level = los;
      effect = eol;
    }
    const typeFlag = getTypeFlag(target);
    if (!typeFlag || level < 0) {
      return target;
    }
    const ret = new ReactivityWrapper(
      target,
      level,
      typeFlag,
      debugSetter,
      effect
    );
    if (isDeclaration) {
      const component = getCurrentInstance();
      if (component) {
        component.__;
      }
    }
    return isDebug ? [ret.proxy, ret.proxy.$] : ret.proxy;
  };
}
function destructuringReactGen(isConst = false) {
  const reactFn = isConst ? constReact : react;
  return (dfnAndSetters, value, level = Infinity) => {
    const [dfn, ...setters] = dfnAndSetters;
    const isDebug = !isUndefined(dfnAndSetters[1]);
    if (!isDebug) {
      return dfn(value).map((v) => {
        return reactFn(v, level);
      });
    }
    return dfn(value).map((v, i) => {
      return reactFn(v, setters[i], level);
    });
  };
}
function processEffect(effect) {
  runSyncEffect(effect[1]);
  scheduleUpdate(effect[0]);
}
function getTypeFlag(v) {
  if (typeof v !== "object" || isNull(v)) {
    return 0;
  }
  if (isArray(v)) {
    return 1;
  }
  const vt = optc(v);
  const referenceTypes = ["Object", "Set", "Map"];
  for (let i = 0; i < 3; i++) {
    if (vt === referenceTypes[i]) {
      return 1 << i;
    }
  }
  return 0;
}

export { AssignmentToProps as A, constDestructuringReact as B, CancelablePromise as C, DerivedDependenNoReactiveValue as D, onAfterUpdate as E, onAfterDestroy as F, onBeforeMount as G, onBeforeUpdate as H, onBeforeDestroy as I, watch as J, effect as K, preWatch as L, preEffect as M, NonTraverse as N, syncWatch as O, syncEffect as P, QingKuaiComponent as Q, createApp as R, nextTick as S, raw as T, AssignmentToDerived as a, spliceByElem as b, internalPreEffect as c, attachDestroy as d, internalEffect as e, DuplicateKey as f, combineContext as g, getContextFuncGen as h, internalSyncEffect as i, destroyBlock as j, extendDsts as k, h as l, mockDirective as m, extendNks as n, onAfterMount as o, isNode as p, insert as q, invokeIndexedHooks as r, setUsedEffectList as s, toRenderStructure as t, usedEffectList as u, vewf as v, withCleanUsedEffectList as w, react as x, constReact as y, destructuringReact as z };
