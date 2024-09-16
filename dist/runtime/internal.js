import { i as isFunction, I as IsProxy, r as reflect, u as undef, a as isUndefined, v as values, l as len, b as isArray, c as isNull, d as IsModuleFunc, e as isString, o as optc, f as entries, g as isNumber, h as arrayFill, j as replaceEachItems, n as nil, k as lastElem, s as setArrLength } from '../chunks/shared.js';
export { m as noop } from '../chunks/shared.js';
import { A as AssignmentToProps, w as withCleanUsedEffectList, s as setUsedEffectList, a as AssignmentToDerived, u as usedEffectList, D as DerivedDependenNoReactiveValue, i as internalSyncEffect, v as vewf, b as spliceByElem, t as toRenderStructure, N as NonTraverse, c as internalPreEffect, d as attachDestroy, e as internalEffect, o as onAfterMount, f as DuplicateKey, m as mockDirective, g as combineContext, h as getContextFuncGen, j as destroyBlock, k as extendDsts, l as h, n as extendNks, C as CancelablePromise, p as isNode, q as insert, r as invokeIndexedHooks } from '../chunks/index.js';
export { Q as QingKuaiComponent, B as constDestructuringReact, y as constReact, z as destructuringReact, x as react } from '../chunks/index.js';

function init(instance) {
  const properties = instance.__;
  return {
    setTemplateStructure(ts) {
      properties.ts = ts;
    },
    slots: properties.slots,
    props: new Proxy(properties.props, {
      get(target, property) {
        const item = target[property];
        if (isFunction(item)) {
          return item(properties.ctx);
        }
        return item;
      },
      set() {
        return AssignmentToProps(), true;
      }
    }),
    refs: new Proxy(properties.refs, {
      get(target, property) {
        return target[property][0](properties.ctx);
      },
      set(target, property, value) {
        return target[property][1](value, properties.ctx), true;
      }
    })
  };
}

const derived = withCleanUsedEffectList((fn, setter) => {
  let init = true;
  let dirty = true;
  let effectList;
  const target = { $: undef };
  const isDebug = !isUndefined(setter);
  const updateDerivedValue = () => {
    const value = fn && fn();
    if (isDebug) {
      setter(value);
    }
    target.$ = value;
  };
  const derivedInit = () => {
    init = false;
    effectList = values(usedEffectList);
    if (len(effectList) === 0) {
      DerivedDependenNoReactiveValue();
    }
    internalSyncEffect(() => {
      dirty = true;
    }, effectList);
  };
  const proxy = new Proxy(target, {
    get(target2, property) {
      if (property === IsProxy) {
        return true;
      }
      if (dirty) {
        dirty = false;
        updateDerivedValue();
      }
      if (init) {
        derivedInit();
      }
      setUsedEffectList(effectList);
      return reflect.get(target2, property);
    },
    set() {
      return AssignmentToDerived(), true;
    }
  });
  return isDebug ? [proxy, target.$] : proxy;
});

const Arrow = "Arrow";
const keyTypes = ["keydown", "keyup", "keypress"];
function eventWrapper(fn, flag = 0, other = "") {
  return function(event) {
    let code = "";
    let shouldInvokeHandler = true;
    const keyRelated = keyTypes.includes(event.type);
    const verify = (fk, ...pks) => {
      if (!shouldInvokeHandler) return;
      if (vewf(flag, fk)) {
        shouldInvokeHandler = pks.includes(code) || event[fk + "Key"];
      }
    };
    if (keyRelated) {
      code = event.code;
      verify("tab", "Tab");
      verify("esc", "Escape");
      verify("space", "Space");
      verify("up", Arrow + "Up");
      verify("down", Arrow + "Down");
      verify("left", Arrow + "Left");
      verify("right", Arrow + "Right");
      verify("del", "Delete", "Backspace");
      verify("enter", "Enter", "NumpadEnter");
      if (shouldInvokeHandler && other) {
        shouldInvokeHandler = code === other;
      }
    }
    verify("alt", ...withLR("Alt"));
    verify("meta", ...withLR("Meta"));
    verify("shift", ...withLR("Shift"));
    verify("ctrl", ...withLR("Control"));
    shouldInvokeHandler && fn.call(this, event);
  };
}
function withReference(eventName, v, setter) {
  const bindHandler = () => (event) => {
    let prop = "value";
    const target = event.target;
    const isInput = target.tagName === "INPUT";
    const isSelect = target.tagName === "SELECT";
    const type = target.type;
    if (isSelect || isInput && (type === "radio" || type === "checkbox")) {
      prop = "checked";
    }
    if (isInput && isArray(v) && target.type === "checkbox") {
      if (target[prop]) {
        v.push(target.value);
      } else {
        spliceByElem(v, target.value);
      }
    } else {
      setter(target[prop]);
    }
  };
  return [eventName, bindHandler, 0];
}
function withLR(code) {
  return [code + "Left", code + "Right"];
}

function aliasModule(rules, ...toms) {
  const aliasModuleFunc = withCleanUsedEffectList((ctx) => {
    const contextValues = [];
    const updateContext = () => {
      for (let i = 0; i < len(rules); i += 2) {
        const [arg, fn] = [rules[i], rules[i + 1]];
        const argIsGetter = isFunction(arg);
        const argv = argIsGetter ? arg(ctx) : arg;
        if (i !== 0) {
          contextValues[0].push(...fn(argv));
        } else {
          replaceEachItems(contextValues, [fn(argv)]);
        }
      }
    };
    updateContext();
    const updateGen = (...args) => {
      const unsetEffect = internalPreEffect(updateContext, effectList);
      attachDestroy(unsetEffect, args[5]);
      return nil;
    };
    const effectList = values(usedEffectList);
    return toRenderStructure(toms, [], {
      t: 2,
      e: effectList,
      v: [1, contextValues, updateGen]
    });
  });
  return attachMarkForModuleFunc(aliasModuleFunc);
}
function ifModule(deps, ...toms) {
  const toms2d = toTwoDemensionalToms(toms);
  const ifModuleFunc = withCleanUsedEffectList((ctx) => {
    let newBlockIndex;
    let oldBlockIndex = findTrueIndex(ctx, deps);
    const effectList = values(usedEffectList);
    const depsWithGetter = usedEffectList.size > 0;
    const updateGen = (instance, _, target, dref, context, dst, dsta, isKeyedTop, keyedInfo) => {
      const updateIfModule = () => {
        const shouleCreateBlock = newBlockIndex !== -1;
        const hasDomOperation = oldBlockIndex !== newBlockIndex;
        if (hasDomOperation) {
          if (isKeyedTop && shouleCreateBlock) {
            resetFirstKeyedInfoItem(keyedInfo);
          }
          if (oldBlockIndex !== -1) {
            keyedInfo.shift();
            destroyBlock(dsta.pop());
          }
          if (shouleCreateBlock) {
            const newDst = extendDsts(dsta);
            toms2d[newBlockIndex].forEach((tom) => {
              const nki = h(
                instance,
                tom,
                target,
                dref,
                true,
                context,
                newDst,
                isKeyedTop
              );
              if (isKeyedTop) {
                extendNks(keyedInfo[0].nks, nki);
              }
            });
          }
        }
        return oldBlockIndex = newBlockIndex, hasDomOperation;
      };
      if (depsWithGetter) {
        const updateBlockIndex = () => {
          newBlockIndex = findTrueIndex(ctx, deps);
        };
        const unsetEffect = internalPreEffect(updateBlockIndex, effectList);
        attachDestroy(unsetEffect, dst);
      }
      return depsWithGetter ? updateIfModule : nil;
    };
    return toRenderStructure(toms2d[oldBlockIndex], [], {
      t: 0,
      e: effectList,
      v: [oldBlockIndex === -1 ? 0 : 1, [], updateGen]
    });
  });
  return attachMarkForModuleFunc(ifModuleFunc);
}
function forModule(dep, ...toms) {
  const depIsGetter = isFunction(dep);
  const ifModuleFunc = withCleanUsedEffectList((ctx) => {
    let oldLength;
    let newLength;
    const value = depIsGetter ? dep(ctx) : dep;
    const effectList = values(usedEffectList);
    const kvPair = getKeyValuePairIterator(value);
    const updateGen = (instance, directive, target, reference, context, dst, dsta, isKeyedTop, keyedInfo) => {
      const updateForModule = () => {
        const drefKeyedInfo = keyedInfo.pop();
        const hasDomOperation = newLength !== oldLength;
        for (let i = newLength; i < oldLength; i++) {
          if (isKeyedTop) {
            keyedInfo.pop();
          }
          destroyBlock(dsta.pop());
        }
        for (let i = oldLength; i < newLength; i++) {
          const newDst = extendDsts(dsta);
          const currentContext = combineContext(directive, context, i);
          if (isKeyedTop) {
            keyedInfo[i] = {
              nks: [],
              dst: newDst
            };
          }
          toms.forEach((tom) => {
            const nki = h(
              instance,
              tom,
              target,
              reference,
              true,
              currentContext,
              newDst,
              isKeyedTop
            );
            if (isKeyedTop) {
              extendNks(keyedInfo[i].nks, nki);
            }
          });
        }
        if (isKeyedTop) {
          keyedInfo.push(drefKeyedInfo);
        }
        return oldLength = newLength, hasDomOperation;
      };
      if (depIsGetter) {
        const updateContext = () => {
          const newPair = getKeyValuePairIterator(dep(ctx));
          updateKeyValuePair(kvPair, newPair);
          newLength = len(newPair);
        };
        const unsetEffect = internalPreEffect(updateContext, effectList);
        attachDestroy(unsetEffect, dst);
      }
      return depIsGetter ? updateForModule : nil;
    };
    return toRenderStructure(toms, [], {
      t: 0,
      e: effectList,
      v: [oldLength = len(kvPair), kvPair, updateGen]
    });
  });
  return attachMarkForModuleFunc(ifModuleFunc);
}
function keyedForModule(dep1, dep2, ...toms) {
  const depIsGetter = isFunction(dep1);
  const keyedForModuleFunc = withCleanUsedEffectList((ctx) => {
    let orderedOldKeys = [];
    let orderedWillKeys = [];
    const value = depIsGetter ? dep1(ctx) : dep1;
    const effectList = values(usedEffectList);
    const kvPair = getKeyValuePairIterator(value);
    const oldKeyPairIndexMap = /* @__PURE__ */ new Map();
    const updateGen = (instance, directive, target, dref, context, dst, dsta, _, keyedInfo) => {
      const updateKeyedForModule = () => {
        let reference = dref;
        let hasDomOperation = false;
        let refKey = orderedOldKeys[0];
        const newLength = len(dep1(ctx));
        const newKeyedInfo = [];
        const newDsta = [];
        const notUsedKeyedInfoItem = new Set(keyedInfo.slice(0, -1));
        for (let i = 0, refIndex = 0; i < newLength; i++) {
          const [willKey, willKeyIndexOfKeyedInfo] = orderedWillKeys[i];
          if (i === 0) {
            reference = getFirstNode(keyedInfo[0]) || dref;
          }
          if (willKeyIndexOfKeyedInfo === -1) {
            const newDst = extendDsts(dsta);
            const newKeyedInfoItem = {
              nks: [],
              dst: newDst
            };
            newDsta.push(newDst);
            newKeyedInfo.push(newKeyedInfoItem);
            toms.forEach((tom) => {
              const currentContext = combineContext(directive, context, i);
              const nki = h(
                instance,
                tom,
                target,
                reference,
                true,
                currentContext,
                newDst,
                true
              );
              extendNks(newKeyedInfoItem.nks, nki);
            });
            hasDomOperation = true;
          } else {
            if (hasDomOperation = refKey !== willKey) {
              reposition(keyedInfo[willKeyIndexOfKeyedInfo], reference);
            } else {
              while (keyedInfo[++refIndex] && !notUsedKeyedInfoItem.has(keyedInfo[refIndex])) ;
              reference = getFirstNode(keyedInfo[refIndex]) || dref;
              refKey = orderedOldKeys[refIndex];
            }
            newDsta.push(keyedInfo[willKeyIndexOfKeyedInfo].dst);
            newKeyedInfo.push(keyedInfo[willKeyIndexOfKeyedInfo]);
            notUsedKeyedInfoItem.delete(keyedInfo[willKeyIndexOfKeyedInfo]);
          }
        }
        notUsedKeyedInfoItem.forEach((item) => {
          notUsedKeyedInfoItem.delete(item);
          item.dst && destroyBlock(item.dst);
        });
        replaceEachItems(dsta, newDsta);
        newKeyedInfo.push(lastElem(keyedInfo));
        replaceEachItems(keyedInfo, newKeyedInfo);
        return hasDomOperation;
      };
      if (depIsGetter) {
        const updateContext = () => {
          const odwk = [];
          const newPair = getKeyValuePairIterator(dep1(ctx));
          for (let i = 0; i < len(newPair); i++) {
            const currentKey = getKey(dep2, newPair, context, i);
            const pairAndIndex = oldKeyPairIndexMap.get(currentKey);
            if (i === 0) {
              setArrLength(kvPair, 0);
            }
            if (!pairAndIndex) {
              kvPair.push(newPair[i]);
            } else {
              replaceEachItems(pairAndIndex[0], newPair[i]);
              kvPair.push(pairAndIndex[0]);
            }
            odwk.push([currentKey, pairAndIndex?.[1] ?? -1]);
          }
          checkDuplicateKey(odwk.map(([k]) => k));
          directive.v[0] = len(newPair);
          orderedWillKeys = odwk;
        };
        const recordOldKeys = () => {
          const odok = [];
          for (let i = 0; i < len(kvPair); i++) {
            const currentKey = getKey(dep2, kvPair, context, i);
            oldKeyPairIndexMap.set(currentKey, [kvPair[i], i]);
            odok.push(currentKey);
          }
          orderedOldKeys = odok;
        };
        const unsetRecordKeysEffect = internalEffect(recordOldKeys, effectList);
        const unsetUpdateContextEffect = internalPreEffect(updateContext, effectList);
        const unsetEffect = () => {
          unsetRecordKeysEffect();
          unsetUpdateContextEffect();
          spliceByElem(instance.__.hooks[1], recordOldKeys);
        };
        onAfterMount(recordOldKeys);
        attachDestroy(unsetEffect, dst);
      }
      checkDuplicateKey(dep2, kvPair, context);
      return depIsGetter ? updateKeyedForModule : nil;
    };
    return toRenderStructure(toms, [], {
      t: 1,
      e: effectList,
      v: [len(kvPair), kvPair, updateGen]
    });
  });
  return attachMarkForModuleFunc(keyedForModuleFunc);
}
function awaitModule(dep, ...toms) {
  const depIsGetter = isFunction(dep);
  const hasPendingBlock = !isNull(toms[0]);
  const toms2d = toTwoDemensionalToms(toms);
  const awaitModuleFunc = withCleanUsedEffectList((ctx) => {
    let currentIsPending = true;
    let cp;
    let value = depIsGetter ? dep(ctx) : dep;
    const waitRes = [[]];
    const effectList = values(usedEffectList);
    const updateGen = (instance, directive, target, reference, context, dst, dsta, isKeyedTop, keyedInfo) => {
      const ch = (index) => {
        if (toms[index]) {
          const newDst = extendDsts(dsta);
          const currentContext = combineContext(directive, context, 0);
          if (isKeyedTop) {
            resetFirstKeyedInfoItem(keyedInfo);
          }
          toms2d[index].forEach((tom) => {
            const nki = h(
              instance,
              tom,
              target,
              reference,
              true,
              currentContext,
              newDst,
              isKeyedTop
            );
            if (isKeyedTop) {
              extendNks(keyedInfo[0].nks, nki);
            }
          });
        }
        currentIsPending = index === 0;
      };
      const awaitPromiseOutcome = (stuIndex, pctx) => {
        invokeIndexedHooks(instance, 2);
        if (hasPendingBlock) {
          if (isKeyedTop) {
            keyedInfo.shift();
          }
          destroyBlock(dsta.pop());
        }
        waitRes[0][0] = pctx;
        ch(stuIndex);
        invokeIndexedHooks(instance, 3);
      };
      const mountPromise = (v) => {
        cp && currentIsPending && cp.cancel();
        cp = new CancelablePromise(v);
        cp.then(
          (res) => awaitPromiseOutcome(1, res),
          (err) => awaitPromiseOutcome(2, err)
        );
      };
      const updateAwaitModule = () => {
        const hasDomOperation = !currentIsPending && hasPendingBlock;
        if (hasDomOperation) {
          destroyBlock(dsta.pop());
          if (isKeyedTop) {
            keyedInfo.shift();
          }
          ch(0);
        }
        value = dep(ctx);
        mountPromise(value);
        return hasDomOperation;
      };
      mountPromise(value);
      return depIsGetter ? updateAwaitModule : null;
    };
    return toRenderStructure(toms2d[0], [], {
      t: 0,
      e: effectList,
      v: [hasPendingBlock ? 1 : 0, waitRes, updateGen]
    });
  });
  return attachMarkForModuleFunc(awaitModuleFunc);
}
function attachMarkForModuleFunc(fn) {
  return fn[IsModuleFunc] = true, fn;
}
function toTwoDemensionalToms(toms) {
  return toms.map((tom) => {
    if (isNull(tom)) {
      return [];
    }
    if (!isArray(tom) || isFunction(tom) || isString(tom[0])) {
      return [tom];
    }
    return tom;
  });
}
function checkDuplicateKey(depOrArr, kvPair, context) {
  const usedDep = kvPair && context;
  const existKeys = /* @__PURE__ */ new Set();
  const times = len(usedDep ? kvPair : depOrArr);
  for (let i = 0; i < times; i++) {
    const key = usedDep ? getKey(depOrArr, kvPair, context, i) : depOrArr[i];
    if (existKeys.has(key)) {
      DuplicateKey(key);
    } else {
      existKeys.add(key);
    }
  }
}
function findTrueIndex(ctx, deps) {
  const vs = (isArray(deps) ? deps : [deps]).map((dep) => {
    return isFunction(dep) ? dep(ctx) : dep;
  });
  return vs.findIndex((dep) => dep);
}
function getKeyValuePairIterator(value) {
  const tps = optc(value);
  if (/Object|Array|String/.test(tps)) {
    return Object.entries(value);
  }
  if (tps === "Set") {
    return values(value).map((v, i) => {
      return [i, v];
    });
  }
  if (tps === "Map") {
    return entries(value);
  }
  if (isNumber(value) && !isNaN(value)) {
    return arrayFill(value, 0).map((_, index) => {
      return [index, index + 1];
    });
  }
  NonTraverse();
}
function updateKeyValuePair(kvPair, newPair, startIndex = 0) {
  const newPairLength = len(newPair);
  for (let i = startIndex; i < newPairLength; i++) {
    if (!kvPair[i]) {
      kvPair[i] = [];
    }
    replaceEachItems(kvPair[i], newPair[i]);
  }
  return setArrLength(kvPair, newPairLength);
}
function getFirstNode(keyedInfoItem) {
  const fst = keyedInfoItem?.nks[0];
  if (!fst) {
    return nil;
  }
  if (isNode(fst)) {
    return fst;
  }
  return getFirstNode(fst[0]);
}
function reposition(keyedInfoItem, reference) {
  keyedInfoItem.nks.forEach((nk) => {
    if (isNode(nk)) {
      insert(nk.parentNode, nk, reference);
    } else {
      nk.forEach((ki) => {
        reposition(ki, reference);
      });
    }
  });
}
function getKey(dep, pair, context, index) {
  if (!dep || !pair) {
    return "" + index;
  }
  if (!isFunction(dep)) {
    return "" + dep;
  }
  const md = mockDirective(pair, context[index]?.e);
  const currentContext = combineContext(md, context, index);
  return "" + dep(getContextFuncGen(currentContext));
}
function resetFirstKeyedInfoItem(keyedInfo) {
  const keyedInfoLen = len(keyedInfo);
  if (keyedInfoLen === 2) {
    keyedInfo[0].nks = [];
  } else if (keyedInfoLen === 1) {
    keyedInfo.unshift({
      nks: [],
      dst: nil
    });
  }
}

export { aliasModule, awaitModule, derived, eventWrapper, forModule, ifModule, init, keyedForModule, nil, withReference };
