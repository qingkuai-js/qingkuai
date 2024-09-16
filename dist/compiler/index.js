import { e as isString, a as isUndefined, s as setArrLength, b as isArray, j as replaceEachItems, g as isNumber, k as lastElem, p as runAll, E as EventWrapperFlag, q as EventListenerFlag, c as isNull } from '../chunks/shared.js';
import { parse as parse$1 } from '@babel/parser';
import { encode } from '@jridgewell/sourcemap-codec';

const templateTag = /^"?template"?$/;
const templateCloseTagRE = /^(?:\s*)((\/)?>)/;
const templateContentRE = /(?:[\s\S](?<!<))*/;
const templateStartTagRE = /^<((?:\S(?<!>))+)/;
const templateEndTagRE = /^<\/((?:\S(?<!>))+)[^>]*>/;
const conditionalCommentRE = /^(?:\[if.*\[endif]|\[if.*<!|<!\[endif])$/;
const templateAttributeRE = /^(\s*)((?:\S(?<!=|>))+)\s*(?:=\s*(['"])([\s\S]*?)\3)?/;
const kebabWholeRE = /^\w|-|(?<=-)\w/g;
const kebabWithoutFirstLetterRE = /-|(?<=-)\w/g;
const reservedIndentifierName = /^(?:prop|ref)s$/;
const bannedIdentifierFormat = /^_(?:[sd]\d+|dn)_$/;
const tagIsComponentRE = /^[A-Z]|-/;
const expressionReplaceWithSpaceRE = /(?:\s|\r?\n)+/y;
const validIdentifierNameRE = /^[a-zA-Z_$][a-zA-Z_$\d]*$/;
const scriptSourceIndentSpaceCount = /\n( +)\S/;
const scriptSourceNeedIndentPlace = /(?<=^|\n)/g;
const scriptSourceRedundantEmptyLine = /^(?: *\r?\n)+|(?:\r?\n *)+(?=\r?\n *\r?\n)|\s+$/g;

function InvalidTagInTemplate() {
  error("Invalid tag.");
}
function TagIsNotClosing(tag) {
  error(`The tag(${tag}) is not closing.`);
}
function UnclosedInterpolationExpression() {
  error("Unclosed interpolation expression.");
}
function TemplateStartsWithEndTag(text) {
  error(`Starts with an end tag: ${text}`);
}
function InvalidIdentifierName(name) {
  error(`The identifier name(${name}) is invalid.`);
}
function SlotNameAttributeIsEmpty() {
  error("The name attribute for slot tag can not be empty.");
}
function EmptyInterpolationExpression() {
  error("Empty interpolation expression block is not allowed.");
}
function UsedKeyDirectiveWithoutForDirective() {
  error("Key directive could not be used without for directive.");
}
function GeneralTagJustAcceptAutoAsReference(tag) {
  error(`General tag(${tag}) can only accept auto as reference.`);
}
function InvalidSlotAttribute(type) {
  const typeChar = type === 1 ? "!" : "&";
  const typeStr = type === 1 ? "Dynamic" : "Reference";
  error(`${typeStr} slot attribute(${typeChar}slot) is not allowed.`);
}
function DuplicateSlotAttributeValue(value) {
  error(`Multiple tags have the same slot attribute value(${value}).`);
}
function CouldNotPassRefValue(key, tag) {
  error(`Can not pass any reference value(${key}) for general tag(${tag}).`);
}
function NoValueForRequiredValueAttribute(key, type) {
  const itemDescription = getCompileRelatedAttributeDescription(type);
  error(`The ${itemDescription}(${key}) must have a value.`);
}
function DirectivesCantCoexist(directives) {
  error(`Directives(${directives.join(", ")}) can not be used simultaneously.`);
}
function EmptyAttributeName(char) {
  const charTypeMap = { "#": 1, "@": 2, "!": 3, "&": 4 };
  const itemDescription = getCompileRelatedAttributeDescription(charTypeMap[char]);
  error(`The ${itemDescription} must be specified a name.`);
}
function InvalidSlotNameAttribute(type) {
  const typeChar = type === 1 ? "!" : "&";
  const typeStr = type === 1 ? "Dynamic" : "Reference";
  error(`${typeStr} name attribute(${typeChar}name) for slot tag is not allowed.`);
}
function RegisterExsitingIdentifierName(name) {
  error(`The identifier name(${name}) to register already exists in the top scope.`);
}
function SlotAttributeIsEmpty() {
  error("The Slot attribute can not be empty for the direct child of a component.");
}
function MissingStartDirective(directive, startDirective) {
  error(`The ${directive} directive must be used after ${startDirective} directive.`);
}
function CompilerFuncNotInTopScope() {
  error(
    "Reactivity related ompiler helper functions(rea, stc, der) must be used in the top scope."
  );
}
function ReferenceValueCantBeUsedWithDynamicType(tag) {
  error(
    `Can not pass reference value when general tag(${tag}) using dynamic type attribute(!type).`
  );
}
function CompilerFuncWithoutVariableDeclaration() {
  error(
    "Reactivity related compiler helper functions(rea, stc, der) must be used for a variable declaration statement."
  );
}
function IdentifierFormatIsNotAllowed(identifier) {
  error(
    `The identifier(${identifier}) format is not allowed, banned identifier format: /${bannedIdentifierFormat.source}/.`
  );
}
function DestructureReactFuncWithNoArg(funcName) {
  error(
    `Compiler helper function(${funcName}) will return undefined when no argument is passed, so it cannot be destructured.`
  );
}
class CompileError extends Error {
  Description;
  constructor(msg) {
    super(msg);
    this.Description = "The QingKuai compiler encountered a fatal error during execution";
  }
}
function error(msg) {
  throw new CompileError(msg);
}
function getCompileRelatedAttributeDescription(type) {
  if (type === 1) {
    return "directive";
  } else if (type === 2) {
    return "event listener";
  } else if (type === 3) {
    return "dynamic attribute";
  } else if (type === 4) {
    return "reference attribute";
  }
}

function normalStringify(v) {
  return JSON.stringify(v);
}
function newASTPosition() {
  return {
    line: 0,
    column: 0,
    index: 0
  };
}
function newASTLocation() {
  return {
    start: newASTPosition(),
    end: newASTPosition()
  };
}
function kebab2Camel(str, startWithUppercase = false) {
  const re = startWithUppercase ? kebabWholeRE : kebabWithoutFirstLetterRE;
  return str.replace(re, (s) => {
    return s === "-" ? "" : s.toUpperCase();
  });
}
function getPositionOfEachChar(str) {
  let line = 1;
  let column = 0;
  let char = str[0];
  const ret = [];
  for (let i = 0; i <= str.length; char = str[++i]) {
    ret.push({ line, column, index: i });
    if (char !== "\n") {
      column++;
    } else {
      line++;
      column = 0;
    }
  }
  return ret;
}
function checkIdentifierName(...names) {
  for (const name of names) {
    if (!validIdentifierNameRE.test(name)) {
      InvalidIdentifierName(name);
    }
  }
}
function isIndexEliminated(index, ranges) {
  for (const range of ranges) {
    const [rangeStart, rangeEnd] = range;
    if (index >= rangeEnd) {
      ranges.delete(range);
      continue;
    }
    if (index >= rangeStart && index < rangeEnd) {
      return true;
    }
  }
  return false;
}
const findOutOfSC = (str, pattern, startIndex) => {
  const withoutStartIndex = isUndefined(startIndex);
  if (withoutStartIndex) {
    startIndex = 0;
  }
  const cr = (index, len) => {
    if (withoutStartIndex) {
      return index;
    } else {
      return [index, len];
    }
  };
  for (let i = startIndex, ls = str; i < str.length; i++, ls = str.slice(i)) {
    if (/^['"`]/.test(str[i])) {
      const endChar = str[i];
      while (str[++i] !== endChar) {
        if ("\\" === str[i]) {
          i++;
          continue;
        }
        if (i >= str.length) {
          return cr(-1, 0);
        }
      }
      ls = str.slice(++i);
    }
    if (ls.startsWith("//")) {
      const endIndex = ls.indexOf("\n");
      if (endIndex === -1) {
        return cr(-1, 0);
      }
      i += endIndex;
      continue;
    }
    if (ls.startsWith("/*")) {
      const endIndex = ls.indexOf("*/");
      if (endIndex === -1) {
        return cr(-1, 0);
      }
      i += endIndex;
      continue;
    }
    if (isString(pattern)) {
      if (ls.startsWith(pattern)) {
        return cr(i, pattern.length);
      }
    } else {
      const re = new RegExp("^" + pattern.source);
      const matched = re.exec(ls);
      if (matched) {
        return cr(i, matched[0].length);
      }
    }
  }
  return cr(-1, 0);
};

const sourceMapInfo = newSourceMapInfo();
const debuggingInfo = newDebuggingInfo();
const replacementInfo = newReplacementInfo();
const inputDescriptor = newInputDescriptor();
const tempStoredImportInfos = [];
const initItems = /* @__PURE__ */ new Set();
const runtimeItems = /* @__PURE__ */ new Set();
const allExistingIdentifiers = /* @__PURE__ */ new Set();
const eliminateRanges = /* @__PURE__ */ new Set();
const stringConstants = /* @__PURE__ */ new Map();
const stringConstantsSourceMap = /* @__PURE__ */ new Map();
function resetCompilerState() {
  initItems.clear();
  runtimeItems.clear();
  eliminateRanges.clear();
  stringConstants.clear();
  allExistingIdentifiers.clear();
  stringConstantsSourceMap.clear();
  setArrLength(tempStoredImportInfos, 0);
  Object.assign(sourceMapInfo, newSourceMapInfo());
  Object.assign(debuggingInfo, newDebuggingInfo());
  Object.assign(replacementInfo, newReplacementInfo());
  Object.assign(inputDescriptor, newInputDescriptor());
}
function newSourceMapInfo() {
  return {
    mappings: [],
    preaddedLineCount: 0,
    removedLine: /* @__PURE__ */ new Set(),
    tempStoredImportStartLine: 0,
    positionShouldNotBeMapped: [],
    existingSourceIndex: /* @__PURE__ */ new Set(),
    columnOffsetOfFirstTemplateLine: 0
  };
}
function newDebuggingInfo() {
  return {
    setters: /* @__PURE__ */ new Map(),
    constIdentifiers: /* @__PURE__ */ new Set()
  };
}
function newReplacementInfo() {
  return {
    count: 0,
    map: /* @__PURE__ */ new Map()
  };
}
function newInputDescriptor() {
  return {
    type: "sfc",
    positions: [],
    indentSpaceCount: 0,
    script: {
      code: "",
      isTS: false,
      loc: newASTLocation(),
      generatedOffset: [0, 0],
      runtime: {
        namespaceIdentifier: "",
        watchIdentifiers: /* @__PURE__ */ new Set()
      }
    }
  };
}

const selfClosingTags = /* @__PURE__ */ new Set([
  "br",
  "img",
  "input",
  "meta",
  "link",
  "hr",
  "base",
  "area",
  "col",
  "embed"
]);
const fullRuntimeItems = /* @__PURE__ */ new Set([
  "QingKuaiComponent",
  "nil",
  "raw",
  "init",
  "noop",
  "react",
  "derived",
  "nextTick",
  "ifModule",
  "forModule",
  "constReact",
  "aliasModule",
  "awaitModule",
  "keyedForModule",
  "eventWrapper",
  "withReference",
  "destructuringReact",
  "constDestructuringReact"
]);
const compilerFuncs = /* @__PURE__ */ new Set(["rea", "stc", "der"]);
const specialTags = /* @__PURE__ */ new Set(["!", "script", "style"]);
const couldUseRefTags = /* @__PURE__ */ new Set(["input", "select", "textarea"]);
const watchRelatedFuncs = /* @__PURE__ */ new Set(["watch", "preWatch", "syncWatch"]);
const fullInitItems = /* @__PURE__ */ new Set(["setTemplateStructure", "props", "refs"]);
const mustPassValueDirectives = /* @__PURE__ */ new Set(["if", "elif", "for", "await", "for", "key"]);

const aliases = /* @__PURE__ */ new Map();
function confirmAliases() {
  fullRuntimeItems.forEach((item) => {
    let alias = item;
    while (allExistingIdentifiers.has(alias)) {
      alias = "_" + alias;
    }
    if (alias !== item) {
      aliases.set(item, alias);
    }
  });
  fullInitItems.forEach((item) => {
    let alias = item;
    while (allExistingIdentifiers.has(alias)) {
      alias = "_" + alias;
    }
    if (alias !== item) {
      aliases.set(item, alias);
    }
  });
}
function getAlias(key, shouldRecord = true) {
  const aliasKey = aliases.get(key);
  const isInitItem = (k) => {
    return fullInitItems.has(k);
  };
  const isRuntimeItem = (k) => {
    return fullRuntimeItems.has(k);
  };
  if (shouldRecord) {
    const isInit = isInitItem(key);
    const isRuntime = isRuntimeItem(key);
    if (aliasKey) {
      if (isInit) {
        key = `${key}: ${aliasKey}`;
      } else if (isRuntime) {
        key = `${key} as ${aliasKey}`;
      }
    }
    if (isInit) {
      initItems.add(key);
    } else if (isRuntime) {
      runtimeItems.add(key);
    }
  }
  return aliasKey || key;
}

const compilerOptions = {
  debugeMode: true,
  generateSourcemap: true,
  reserveTemplateComment: false
};

function getScriptLoc(index) {
  const {
    positions,
    script: {
      loc: { start: startLoc }
    }
  } = inputDescriptor;
  const sourceLoc = positions[index + startLoc.index];
  const ret = {
    index,
    line: 0,
    column: sourceLoc.column
  };
  ret.line = sourceLoc.line - startLoc.line + 1;
  if (sourceLoc.line === startLoc.line) {
    ret.column -= startLoc.column;
  }
  return ret;
}
function getSetterIdentifier(identifier) {
  return `_d${debuggingInfo.setters.get(identifier)}_`;
}
function indent(n = 1) {
  return " ".repeat(inputDescriptor.indentSpaceCount * n);
}
function getGeneratedLine(line) {
  return line + inputDescriptor.script.loc.start.line - 2;
}
function stringify(v) {
  const s = JSON.stringify(v);
  if (stringConstants.has(s)) {
    const existingItem = stringConstants.get(s);
    existingItem.count++;
    return existingItem.value;
  } else {
    const value = `_s${stringConstants.size}_`;
    stringConstants.set(s, {
      value,
      count: 1,
      using: false
    });
    stringConstantsSourceMap.set(value, s);
    return value;
  }
}
function markSegmentShouldNotBeMapped(start, end) {
  {
    for (let i = start; i < end; i++) {
      sourceMapInfo.positionShouldNotBeMapped[i] = true;
    }
  }
}

function parseTemplate(source) {
  let index = 0;
  let closeMatched;
  let endTagMatched;
  const astList = [];
  const sourceLength = source.length;
  const positions = getPositionOfEachChar(source);
  function reduceSource(start) {
    index += start;
    source = source.slice(start);
  }
  function parseContent(parent) {
    const content = templateContentRE.exec(source)[0];
    const contentLen = content.length;
    if (contentLen) {
      if (content.trim()) {
        (parent?.children || astList).push(
          initTemplateNode({
            content,
            parent,
            range: [index, index + contentLen]
          })
        );
      }
      reduceSource(contentLen);
    }
  }
  function parse(parent) {
    if (source.startsWith("</")) {
      endTagMatched = templateEndTagRE.exec(source);
      if (!endTagMatched) {
        InvalidTagInTemplate();
      } else {
        TemplateStartsWithEndTag(endTagMatched[0]);
      }
    }
    while (source.startsWith("<!--")) {
      const endCharsIndex = source.indexOf("-->");
      const range = [index, -1];
      const commentContent = source.slice(4, endCharsIndex);
      if (endCharsIndex !== -1) {
        reduceSource(endCharsIndex + 3);
        range[1] = index;
      }
      return initTemplateNode({
        range,
        tag: "!",
        children: [
          initTemplateNode({
            tag: "",
            content: commentContent,
            range: [range[0] + 4, index - 3]
          })
        ]
      });
    }
    const startTagMatched = templateStartTagRE.exec(source);
    if (!startTagMatched) {
      InvalidTagInTemplate();
    }
    const ast = initTemplateNode({
      parent,
      range: [index, -1],
      tag: startTagMatched[1]
    });
    const isScript = ast.tag === "script";
    reduceSource(ast.tag.length + 1);
    while (!(closeMatched = templateCloseTagRE.exec(source))) {
      const attr = templateAttributeRE.exec(source);
      const endIndex = index + attr[0].length;
      const startIndex = index + attr[1].length;
      const keyEndIndex = startIndex + attr[2].length;
      const valueStartIndex = endIndex - attr[4]?.length - 1;
      const attrStruct = {
        key: {
          raw: attr[2],
          loc: {
            start: positions[startIndex],
            end: positions[keyEndIndex]
          }
        },
        value: {
          raw: attr[4] || "",
          loc: {
            start: positions[valueStartIndex],
            end: positions[endIndex - 1]
          }
        },
        loc: {
          start: positions[startIndex],
          end: positions[endIndex]
        }
      };
      reduceSource(attr[0].length);
      ast.attributes.push(attrStruct);
      if (isScript) {
        const {
          key: { raw: key },
          value: { raw: value }
        } = attrStruct;
        if (key === "lang" && value === "ts") {
          inputDescriptor.script.isTS = true;
        }
      }
      if (isUndefined(attr[4])) {
        attrStruct.value.loc = newASTLocation();
      }
    }
    reduceSource(closeMatched[0].length);
    if (isScript) {
      const endIndex = findOutOfSC(source, "<\/script>");
      inputDescriptor.script.loc = {
        start: positions[index],
        end: positions[endIndex + index]
      };
      inputDescriptor.script.code = source.slice(0, endIndex);
      reduceSource(endIndex + 9);
      return;
    }
    if (!selfClosingTags.has(ast.tag) && !closeMatched[2]) {
      while (!(endTagMatched = new RegExp(`^</${ast.tag}[^>]*>`).exec(source))) {
        if (!source) {
          TagIsNotClosing(ast.tag);
        }
        if (!source.startsWith("<")) {
          parseContent(ast);
        } else {
          const child = parse(ast);
          child && ast.children.push(child);
        }
      }
      reduceSource(endTagMatched[0].length);
    }
    ast.range[1] = index;
    ast.loc.end = positions[index];
    const isConditionalComment = conditionalCommentRE.test(ast.content);
    const reserveThisComment = ast.tag === "!" && (isConditionalComment);
    if (!specialTags.has(ast.tag) || !reserveThisComment) {
      return ast;
    }
  }
  function initTemplateNode(options = {}) {
    if (!options.loc) {
      const { range } = options;
      if (range) {
        options.loc = {
          start: positions[range[0]],
          end: positions[range[1]]
        };
      }
    }
    return {
      parent: options.parent || null,
      tag: options.tag || "",
      content: options.content || "",
      range: options.range || [-1, -1],
      loc: options.loc || newASTLocation(),
      attributes: options.attributes || [],
      children: options.children || []
    };
  }
  while (true) {
    parseContent(null);
    if (index >= sourceLength) {
      break;
    }
    const ast = parse(null);
    ast && astList.push(ast);
  }
  inputDescriptor.positions = positions;
  return astList.filter((ast) => {
    return ast.tag !== "!" || conditionalCommentRE.test(ast.content);
  });
}

function is(node, type) {
  return node?.type === type;
}
function isFunctionNode(node) {
  return is(node, "FunctionDeclaration") || is(node, "FunctionExpression") || is(node, "ArrowFunctionExpression");
}
function isTypeOperationExpression(node) {
  return is(node, "TSAsExpression") || is(node, "TSTypeAssertion") || is(node, "TSNonNullExpression") || is(node, "TSSatisfiesExpression");
}
function identifierIsReference(node, { v: parent }) {
  const notReferenceWhenParentIs = /* @__PURE__ */ new Set([
    "CatchClause",
    "ArrayPattern",
    "BreakStatement",
    "ClassExpression",
    "ClassDeclaration",
    "LabeledStatement",
    "ContinueStatement",
    "FunctionExpression",
    "FunctionDeclaration"
  ]);
  if (!parent) {
    return true;
  }
  if (parent.type.startsWith("TS")) {
    return false;
  }
  switch (parent.type) {
    case "VariableDeclarator":
      return parent.id !== node;
    case "ClassMethod":
    case "ObjectMethod":
      return parent.computed;
    case "ObjectProperty":
      if (parent.shorthand) {
        return node !== parent.key;
      }
      return parent.computed || parent.key !== node;
    case "ClassProperty":
      return parent.computed || parent.key !== node;
    case "MemberExpression":
      return parent.computed || parent.property !== node;
    default:
      return !notReferenceWhenParentIs.has(parent.type);
  }
}

function parse(source) {
  const parseOption = {
    sourceType: "module"
  };
  if (inputDescriptor.script.isTS) {
    parseOption.plugins = ["typescript"];
  }
  return parse$1(source, parseOption).program;
}
function getEsNode(node) {
  while (isTypeOperationExpression(node)) {
    node = node.expression;
  }
  return node;
}
function getEsNodeOfParent(cur) {
  while (isTypeOperationExpression(cur?.v)) {
    cur = cur.parent;
  }
  return cur;
}
function markExcludes(excludes, identifiers) {
  identifiers.forEach((identifier) => {
    excludes.add(identifier);
  });
}
function functionMarkExcludes(node, excludes) {
  node.params.forEach((param) => {
    if (!is(param, "TSParameterProperty")) {
      markExcludes(excludes, getIdentifiersFromPattern(param));
    } else {
      markExcludes(excludes, getIdentifiersFromPattern(param.parameter));
    }
  });
  if (is(node, "FunctionDeclaration")) {
    markExcludes(excludes, getIdentifiersFromPattern(node.id));
  }
}
function getIdentifiersFromPattern(nodes) {
  const identifiers = [];
  const patterns = isArray(nodes) ? nodes : [nodes];
  patterns.forEach((pattern) => {
    esPatternWalk(pattern, void 0, (node) => {
      identifiers.push(node.name);
    });
  });
  return identifiers;
}
function getIdentifiersFromPatternWithPath(source, nodes) {
  const ret = /* @__PURE__ */ new Map();
  const patterns = isArray(nodes) ? nodes : [nodes];
  patterns.forEach((pattern) => {
    esPatternWalk(pattern, [], (node, pathArr) => {
      const pathStrArr = pathArr.map((item) => {
        if (!isArray(item)) {
          return item;
        }
        return `[${source.slice(item[0], item[1])}]`;
      });
      ret.set(node.name, pathStrArr.join(""));
    });
  });
  return ret;
}
function initReplacementItem(options) {
  const id = ++replacementInfo.count;
  const order = options.order || Infinity;
  return {
    id,
    order,
    processed: false,
    text: options.text,
    index: options.index
  };
}
function extendReplacement(names, useDollar, createSetter, items, status = "pending") {
  const repl = {
    createSetter,
    useDollar,
    status,
    items
  };
  names = isArray(names) ? names : [names];
  names.forEach((name) => {
    replacementInfo.map.set(name, repl);
  });
}
function esPatternWalk(node, arr, callback) {
  const shouldRecordPath = !isUndefined(arr);
  const recursive = (n, carr = arr) => {
    esPatternWalk(n, carr, callback);
  };
  if (node) {
    switch (node.type) {
      case "AssignmentPattern":
        recursive(node.left);
        break;
      case "RestElement":
        recursive(node.argument);
        break;
      case "Identifier":
        callback(node, arr);
        break;
      case "ArrayPattern":
        node.elements.forEach((elem, index) => {
          const elemPattern = elem;
          if (!shouldRecordPath) {
            recursive(elemPattern);
          } else {
            const carr = arr.slice();
            carr.push(`[${index}]`);
            recursive(elemPattern, carr);
          }
        });
        break;
      case "ObjectPattern":
        node.properties.forEach((prop) => {
          if (is(prop, "ObjectProperty")) {
            if (!shouldRecordPath) {
              recursive(prop.value);
            } else {
              const carr = arr.slice();
              if (prop.computed) {
                const { start, end } = prop.key;
                carr.push([start, end]);
              } else if (is(prop.key, "Identifier")) {
                carr.push(`.${prop.key.name}`);
              }
              recursive(prop.value, carr);
            }
          } else {
            recursive(prop.argument);
          }
        });
        break;
    }
  }
}

function walk(node, visitor, parent = {
  v: null,
  parent: null,
  excludes: /* @__PURE__ */ new Set()
}) {
  const visit = visitor[node.type];
  const keys = Object.keys(node);
  const r = (n) => {
    if (n.loc) {
      const curParent = {
        parent,
        v: node,
        excludes: new Set(parent.excludes)
      };
      walk(n, visitor, curParent);
    }
  };
  if (visit) {
    visit(node, parent);
  }
  visitor.AnyNode?.(node, parent);
  for (const key of keys) {
    if (node[key] && typeof node[key] === "object") {
      const value = node[key];
      if (isArray(value)) {
        value.forEach((v) => {
          r(v);
        });
      } else {
        r(value);
      }
    }
  }
}

function recordMapping(generatedLine, generatedColumn, sourceLine, sourceColumn, sourceIndex, isTemplate = false) {
  sourceLine = getGeneratedLine(sourceLine);
  {
    sourceLine += 10;
  }
  initGeneratedLineMapping(generatedLine);
  if (!sourceMapInfo.existingSourceIndex.has(sourceIndex)) {
    const targetLine = sourceMapInfo.mappings[generatedLine];
    const segment = [generatedColumn, +isTemplate, sourceLine, sourceColumn];
    targetLine.push(segment);
    for (let i = targetLine.length - 1; i > 0; i--) {
      if (targetLine[i][0] < targetLine[i - 1][0]) {
        [targetLine[i], targetLine[i - 1]] = [targetLine[i - 1], targetLine[i]];
      }
    }
    sourceMapInfo.existingSourceIndex.add(sourceIndex);
  }
}
function offsetSourcemap() {
  let temp = [];
  const { indentSpaceCount } = inputDescriptor;
  const scriptLoc = inputDescriptor.script.loc;
  const scriptStartPosition = scriptLoc.start;
  const firstTemplateLine = scriptLoc.end.line + 3;
  for (let i = 0; i < sourceMapInfo.preaddedLineCount + 8; i++) {
    temp.push([]);
  }
  sourceMapInfo.mappings.forEach((line, index) => {
    if (!sourceMapInfo.removedLine.has(index)) {
      temp.push(line);
    }
    line.forEach((segment) => {
      if (index === 1) {
        segment[3] += scriptStartPosition.column;
      }
      if (segment[1] !== 1) {
        segment[0] += indentSpaceCount;
      } else {
        if (index === firstTemplateLine) {
          segment[0] += sourceMapInfo.columnOffsetOfFirstTemplateLine;
        }
        segment[1] = 0;
      }
    });
  });
  for (let i = 0; i < tempStoredImportInfos.length; i++) {
    const { mappingLine } = tempStoredImportInfos[i];
    mappingLine.forEach((segment) => {
      if (segment[2] === scriptStartPosition.line - 1) {
        segment[3] += scriptStartPosition.column;
      }
      {
        segment[2] += 10;
      }
    });
    temp[i + sourceMapInfo.tempStoredImportStartLine] = mappingLine;
  }
  replaceEachItems(sourceMapInfo.mappings, temp);
}
function initGeneratedLineMapping(line) {
  if (sourceMapInfo.mappings[line]) {
    return;
  }
  while (isUndefined(sourceMapInfo.mappings[line])) {
    sourceMapInfo.mappings[line--] = [];
    if (line < 0) {
      break;
    }
  }
}

function recordMappingWithNoOffset(position) {
  const { line, column, index } = position;
  if (!sourceMapInfo.positionShouldNotBeMapped[index]) {
    recordMapping(line, column, line, column, index);
  }
}

function RedundantArgs(fn, need) {
  let needMsg = "requires only one parameter";
  if (!isNumber(need) || need > 1) {
    needMsg = `accepts a maximum of ${need} parameters`;
  }
  warn(`${fn} ${needMsg}, and the excess parameters has been ignored.`);
}
function DerLoseReactivity() {
  warn("Destructure the return value of der will result in a loss of reacativity.");
}
function MixTwoSyntaxOfDerived() {
  warn("Mixing the two syntax to declare derived reactive state is not recommended.");
}
function InvalidEventFlag(flagName, eventName) {
  warn(`Invalid flag(${flagName}) for event(@${eventName}) and it has been ignored.`);
}
function InvalidEventForSlot(eventName) {
  warn(`Event listener(${eventName}) is invalid for slot tag, and it has been ignored.`);
}
function InvalidEventFlagForComponent(flagStr) {
  flagStr = flagStr.replaceAll("|", ", ");
  warn(
    `The event parameter for component can not accept any flag(${flagStr}), and they has been ignored.`
  );
}
function DuplicateAttributeKey(tag, key, isDirective) {
  const kind = isDirective ? "directive" : "attribute";
  warn(
    `Duplicate ${kind} item(${key}) for ${tag} tag, the later one has been applied according to the priority.`
  );
}
function warn(msg) {
  console.warn(msg);
}

const visitor = {
  VariableDeclaration(node, parent) {
    analyzeReactivity(node, parent);
  },
  FunctionDeclaration(node, parent) {
    functionMarkExcludes(node, parent.excludes);
  },
  ClassDeclaration(node, parent) {
    const name = node.id.name;
    const id = `[_w_${name}, ${name}]` ;
    const getReactFunc = () => {
      return getAlias("react");
    };
    const getSetterArg = () => {
      return ", " + getSetterIdentifier(name) ;
    };
    if (is(parent.v, "Program") && name) {
      extendReplacement(name, false, true, [
        initReplacementItem({
          index: node.start,
          text: () => `let ${id} = ${getReactFunc()}(`
        }),
        initReplacementItem({
          index: node.end,
          text: () => `${getSetterArg()})`
        })
      ]);
    }
    markExcludes(parent.excludes, getIdentifiersFromPattern(node.id));
  },
  CallExpression(node, parent) {
    const callee = getEsNode(node.callee);
    const esParent = getEsNodeOfParent(parent);
    const esGrand = getEsNodeOfParent(esParent?.parent);
    const esGreatGrand = getEsNodeOfParent(esGrand?.parent);
    if (is(callee, "Identifier")) {
      const funcName = callee.name;
      const isExclude = parent.excludes.has(funcName);
      if (compilerFuncs.has(funcName) && !isExclude) {
        if (!is(esParent.v, "VariableDeclarator")) {
          CompilerFuncWithoutVariableDeclaration();
        }
        if (!is(esGreatGrand?.v, "Program")) {
          if (!parent.excludes.has(funcName)) {
            CompilerFuncNotInTopScope();
          }
        }
      }
    }
    analyzeWatch(node, parent);
  },
  Identifier(node, parent) {
    const { name } = node;
    const grand = parent.parent;
    const esParent = getEsNodeOfParent(parent);
    const replacementItem = replacementInfo.map.get(name);
    const accessByDotDollar = replacementItem?.useDollar && !parent.excludes.has(name);
    if (bannedIdentifierFormat.test(name)) {
      IdentifierFormatIsNotAllowed(name);
    }
    allExistingIdentifiers.add(name);
    if (identifierIsReference(node, parent)) {
      if (accessByDotDollar && is(esParent?.v, "ObjectProperty") && esParent.v.shorthand) {
        if (grand && is(getEsNodeOfParent(grand).v, "ObjectExpression")) {
          replacementInfo.map.get(name).items.push(
            initReplacementItem({
              index: node.end,
              text: `: ${"_w_" }${name}.$`
            })
          );
        }
        return;
      }
      if (accessByDotDollar) {
        {
          replacementItem.items.push(
            initReplacementItem({
              text: "_w_",
              index: node.start
            })
          );
        }
        replacementItem.items.push(
          initReplacementItem({
            order: 1,
            text: ".$",
            index: node.end
          })
        );
      }
    }
  },
  ImportDeclaration(node) {
    const { start, end } = node;
    const scriptSource = inputDescriptor.script.code;
    const isQingKuaiRuntime = node.source.value === "qingkuai";
    eliminateRanges.add([start, end]);
    node.specifiers.forEach(({ local: { name } }) => {
      if (reservedIndentifierName.test(name)) {
        RegisterExsitingIdentifierName(name);
      }
    });
    tempStoredImportInfos.push({
      mappingLine: [],
      startColumn: node.loc.start.column,
      code: scriptSource.slice(start, end)
    });
    if (isQingKuaiRuntime) {
      node.specifiers.forEach((specifier) => {
        if (is(specifier, "ImportSpecifier")) {
          const { imported } = specifier;
          if (is(imported, "Identifier")) {
            if (watchRelatedFuncs.has(imported.name)) {
              inputDescriptor.script.runtime.watchIdentifiers.add(
                specifier.local.name
              );
            }
          }
        } else if (is(specifier, "ImportNamespaceSpecifier")) {
          inputDescriptor.script.runtime.namespaceIdentifier = specifier.local.name;
        }
      });
    }
  },
  FunctionExpression(node, parent) {
    functionMarkExcludes(node, parent.excludes);
  },
  ClassExpression(node, parent) {
    markExcludes(parent.excludes, getIdentifiersFromPattern(node.id));
  },
  // 任意节点都将被捕获进入，此捕获组主要用来记录sourcemap信息，具体分为下面几种情况：
  // 1. 非import语句（且不是Program）节点时，统一记录sourcemap信息
  // 2. import语句的sourcemap信息单独记录，因为import语句会被提升到生成代码的顶部
  // 3. 当处于调试模式时，需要将变量声明关键字的结束位置添加到映射，因为标识符名称可能会添加_w_前缀
  AnyNode(node, parent) {
    {
      if (is(node, "ImportDeclaration") || is(parent.v, "ImportSpecifier") || is(parent.v, "ImportDeclaration") || is(parent.v, "ImportDefaultSpecifier")) {
        const curInfo = lastElem(tempStoredImportInfos);
        const { startColumn, mappingLine } = curInfo;
        const { line, column } = node.loc.start;
        const sourceLine = getGeneratedLine(line);
        const generatedColumn = column - startColumn;
        mappingLine.push([generatedColumn, 0, sourceLine, column]);
      } else {
        if (!is(node, "Program")) {
          recordMappingWithNoOffset(node.loc.start);
          recordMappingWithNoOffset(node.loc.end);
        }
      }
    }
  }
};
function analyzeReactivity(node, parent) {
  let reactFunc;
  let idRange;
  let initRange;
  let firstArgRange;
  let hasInit = false;
  let hasFnArg = false;
  let hasFnCall = false;
  let isDerived = false;
  let useLetKeyword = false;
  let isDestructuring = false;
  let derInitTransToFunc = false;
  let destructuringIdentifierArr = [];
  const isConst = node.kind === "const";
  const esParent = getEsNodeOfParent(parent);
  const isInTopScope = is(esParent.v, "Program");
  const scriptSource = inputDescriptor.script.code;
  const extend = (names) => {
    let useDollar = true;
    let internalReactFunc = "";
    let status = "pending";
    const createSetter = isDerived || !isConst;
    const replacementItems = [];
    const valueRange = hasFnCall ? firstArgRange : initRange;
    const noInitOrNoArg = hasFnCall && !hasFnArg || !hasFnCall && !hasInit;
    const getReactFunc = () => {
      return `${getAlias(internalReactFunc)}(`;
    };
    if (isDerived || reactFunc === "rea") {
      status = "rea";
    }
    if (reactFunc === "stc") {
      status = "stc";
      useDollar = false;
      internalReactFunc = "";
    } else {
      if (isDerived) {
        internalReactFunc = "derived";
        useDollar = !isDestructuring;
      } else {
        if (!isConst) {
          if (!isDestructuring) {
            internalReactFunc = "react";
          } else {
            internalReactFunc = "destructuringReact";
          }
        } else {
          if (!isDestructuring) {
            internalReactFunc = "constReact";
          } else {
            internalReactFunc = "constDestructuringReact";
          }
        }
      }
    }
    if (!internalReactFunc && !hasFnArg) {
      replacementItems.push(
        initReplacementItem({
          index: initRange[0],
          text: "void 0"
        })
      );
    }
    if (isDerived) {
      const getSetterArg = () => {
        return `, ${getSetterIdentifier(names[0])}`;
      };
      if (useLetKeyword) {
        useLetKeyword = false;
        replacementItems.push(
          initReplacementItem({
            index: idRange[0],
            text: "let "
          })
        );
      }
      if (!isDestructuring) {
        replacementItems.push(
          initReplacementItem({
            index: idRange[0],
            text: "[_w_"
          }),
          initReplacementItem({
            index: idRange[1],
            text: `, ${names[0]}]`
          })
        );
      }
      let [rwp, cwr] = [false, ["", ""]];
      if (derInitTransToFunc) {
        if (!noInitOrNoArg) {
          rwp = scriptSource[valueRange[0]] === "{";
          rwp && (cwr = ["(", ")"]);
        } else {
          const equalToken = hasFnCall ? "" : " = ";
          const gsa = () => getSetterArg() ;
          replacementItems.push(
            initReplacementItem({
              index: hasFnCall ? initRange[0] : idRange[1],
              text: () => `${equalToken}${getReactFunc()}_ => void 0${gsa()})`
            })
          );
        }
      }
      if (!noInitOrNoArg) {
        replacementItems.push(
          initReplacementItem({
            index: initRange[0],
            text: () => {
              const arrowFuncStr = derInitTransToFunc ? "_ => " : "";
              return `${getReactFunc()}${arrowFuncStr}${cwr[0]}`;
            }
          })
        );
        if (isDestructuring) {
          replacementItems.push(
            initReplacementItem({
              index: initRange[1],
              text: `${cwr[1]}).$`
            })
          );
        } else {
          replacementItems.push(
            initReplacementItem({
              index: valueRange[1],
              text: () => `${getSetterArg()})`
            })
          );
        }
      }
    }
    if (!isDerived && internalReactFunc) {
      if (!isDestructuring) {
        const getSetterArg = (ret = "") => {
          {
            if (isConst) {
              ret = getAlias("noop");
            } else {
              ret = getSetterIdentifier(names[0]);
            }
          }
          return ret ? ", " + ret : ret;
        };
        {
          replacementItems.push(
            initReplacementItem({
              index: idRange[0],
              text: "[_w_"
            }),
            initReplacementItem({
              index: idRange[1],
              text: () => `, ${names[0]}]`
            })
          );
        }
        if (noInitOrNoArg) {
          const equalToken = hasFnCall ? "" : " = ";
          if (!isConst) {
            replacementItems.push(
              initReplacementItem({
                index: hasFnCall ? initRange[0] : idRange[1],
                text: () => `${equalToken}${getReactFunc()}void 0${getSetterArg()})`
              })
            );
          }
        } else {
          replacementItems.push(
            initReplacementItem({
              index: initRange[0],
              text: () => getReactFunc()
            })
          );
          {
            replacementItems.push(
              initReplacementItem({
                index: valueRange[1],
                text: () => getSetterArg()
              })
            );
          }
          replacementItems.push(
            initReplacementItem({
              index: initRange[1],
              text: ")"
            })
          );
        }
      } else {
        const id = `[${destructuringIdentifierArr.join(", ")}]`;
        const equalTokenIndex = findOutOfSC(scriptSource, "=", idRange[1])[0];
        const markReplacementCommon = (idStr) => {
          replacementItems.push(
            initReplacementItem({
              index: idRange[0],
              text: () => `${idStr} = ${getReactFunc()}[(`
            }),
            initReplacementItem({
              index: idRange[1],
              text: ")"
            }),
            initReplacementItem({
              index: initRange[1],
              text: ")"
            })
          );
        };
        {
          const ddIdentifierArr = destructuringIdentifierArr.map((item) => {
            return `[_w_${item}, ${item}]`;
          });
          markReplacementCommon(`[${ddIdentifierArr.join(", ")}]`);
          replacementItems.push(
            initReplacementItem({
              index: equalTokenIndex + 1,
              text: () => {
                const setters = destructuringIdentifierArr.map((identifier) => {
                  if (isConst) {
                    return getAlias("noop");
                  } else {
                    return getSetterIdentifier(identifier);
                  }
                });
                return `> ${id}, ${setters.join(", ")}],`;
              }
            })
          );
        }
      }
    }
    if (replacementItems.length) {
      extendReplacement(names, useDollar, createSetter, replacementItems, status);
    }
  };
  node.declarations.forEach(({ id, init, end }, index) => {
    let initEnd = init?.end ?? end;
    let initStart = init?.start ?? end;
    const esInit = init ? getEsNode(init) : init;
    const idTypeAnnotation = id.typeAnnotation;
    const names = getIdentifiersFromPattern(id);
    const esInitIsIdentifierCallee = hasFnCall = is(esInit, "CallExpression");
    const esCallee = esInitIsIdentifierCallee ? getEsNode(esInit.callee) : null;
    const calleeName = is(esCallee, "Identifier") ? esCallee.name : "";
    if (!isInTopScope) {
      names.forEach((name) => {
        parent.parent?.excludes.add(name);
      });
      return;
    }
    if (idTypeAnnotation) {
      const { start, end: end2 } = idTypeAnnotation;
      eliminateRanges.add([start, end2]);
    }
    reactFunc = "";
    hasInit = Boolean(init);
    idRange = [id.start, id.end];
    initRange = [initStart, initEnd];
    if (esInitIsIdentifierCallee) {
      hasFnCall = compilerFuncs.has(calleeName);
      if (hasFnCall) {
        reactFunc = calleeName;
        hasFnArg = esInit.arguments.length > 0;
      }
    }
    if (is(id, "ObjectPattern") || is(id, "ArrayPattern")) {
      isDestructuring = true;
      markSegmentShouldNotBeMapped(idRange[0], idRange[1] + 1);
      destructuringIdentifierArr = getIdentifiersFromPattern(id);
    } else if (is(id, "Identifier")) {
      isDerived = id.name.startsWith("$");
      if (isDerived) {
        if (esInitIsIdentifierCallee && calleeName === "der") {
          MixTwoSyntaxOfDerived();
        }
      }
    }
    if (hasFnCall) {
      const cinit = init;
      const [firstArg, secondArg] = cinit.arguments;
      const [cs, ce] = [cinit.callee.start, cinit.end];
      if (hasFnArg) {
        const argLen = cinit.arguments.length;
        const [_, se] = [secondArg?.start, secondArg?.end];
        const [__, fe] = firstArgRange = [firstArg.start, firstArg.end];
        const ps = findOutOfSC(scriptSource, "(", init.start)[0] + 1;
        switch (calleeName) {
          case "stc":
            eliminateRanges.add([cs, ps]);
            eliminateRanges.add([fe, ce]);
            if (argLen > 1) {
              RedundantArgs("stc", 1);
            }
            break;
          case "rea":
            eliminateRanges.add([cs, ps]);
            if (argLen > 2) {
              RedundantArgs("rea", 2);
              eliminateRanges.add([se, ce]);
            } else {
              eliminateRanges.add([ce - 1, ce]);
            }
            break;
          case "der":
            isDerived = true;
            eliminateRanges.add([cs, ps]);
            if (argLen > 1) {
              RedundantArgs("der", 1);
              eliminateRanges.add([fe, ce]);
            } else {
              eliminateRanges.add([ce - 1, ce]);
            }
            break;
        }
      } else {
        reactFunc = calleeName;
        eliminateRanges.add(initRange);
        isDerived = reactFunc === "der";
        if (isDestructuring) {
          DestructureReactFuncWithNoArg(reactFunc);
        }
      }
    }
    if (isDerived) {
      if (isDestructuring) {
        DerLoseReactivity();
      } else if (isConst && index === 0) {
        useLetKeyword = true;
        eliminateRanges.add([node.start, idRange[0]]);
      }
      if (!esInitIsIdentifierCallee) {
        derInitTransToFunc = !isFunctionNode(init);
      } else {
        derInitTransToFunc = !isFunctionNode(esInit.arguments[0]);
      }
      if (derInitTransToFunc) {
        markSegmentShouldNotBeMapped(initRange[0], initRange[1] + 1);
      }
    }
    extend(names);
    names.forEach((name) => {
      if (compilerFuncs.has(name) || reservedIndentifierName.test(name)) {
        RegisterExsitingIdentifierName(name);
      }
    });
  });
}
function analyzeWatch(node, parent) {
  const { callee } = node;
  const firstArg = node.arguments[0];
  const scriptSource = inputDescriptor.script.code;
  const emptyStringReplacement = replacementInfo.map.get("");
  const retUseParentheses = scriptSource[firstArg.start || 0] === "{";
  const { namespaceIdentifier, watchIdentifiers } = inputDescriptor.script.runtime;
  if (node.arguments.length === 0) {
    return;
  }
  if (is(callee, "Identifier") && !parent.excludes.has(callee.name) && watchIdentifiers.has(callee.name) || is(callee, "MemberExpression") && is(callee.object, "Identifier") && is(callee.property, "Identifier") && !parent.excludes.has(callee.object.name) && callee.object.name === namespaceIdentifier && watchRelatedFuncs.has(callee.property.name)) {
    emptyStringReplacement.items.push(
      initReplacementItem({
        index: firstArg.start,
        text: `_ => ${retUseParentheses ? "(" : ""}`
      })
    );
    if (retUseParentheses) {
      emptyStringReplacement.items.push(
        initReplacementItem({
          index: firstArg.end,
          text: ")"
        })
      );
    }
  }
}
function analyzeScript(source) {
  const indentSpaceCount = scriptSourceIndentSpaceCount.exec(source)?.[1].length || 2;
  inputDescriptor.indentSpaceCount = indentSpaceCount;
  replacementInfo.map.set("", {
    createSetter: false,
    useDollar: false,
    status: "rea",
    items: []
  });
  walk(parse(source), visitor);
  confirmAliases();
  getAlias("init");
  getAlias("QingKuaiComponent");
  getAlias("setTemplateStructure");
}

function transformExpression(expression, startIndex, context, type, optionalParams = {}) {
  let useGetter = false;
  let useContext = false;
  const indexMap = [];
  const transformedArr = [];
  const contextVariables = [];
  const sourcemapIndexes = [];
  const afterWalkFuncs = [];
  const mappings = [];
  const expEliminateRanges = /* @__PURE__ */ new Set();
  const transformInfos = /* @__PURE__ */ new Map();
  const noPositionMap = isUndefined(optionalParams.positionMap);
  const isKeyDirective = optionalParams.isKeyDirective || false;
  const isComponentEvent = optionalParams.isComponentEvent === true;
  const ast = parse("_=" + expression).body[0].expression.right;
  const isEvent = !isUndefined(optionalParams.eventWrapperFlag) || isComponentEvent;
  const extendTransformInfo = (index, str) => {
    const item = transformInfos.get(index - 2);
    if (item) {
      item.push(str);
    } else {
      transformInfos.set(index - 2, [str]);
    }
  };
  walk(ast, {
    Identifier(node, parent) {
      const { name, start, end } = node;
      if (bannedIdentifierFormat.test(name)) {
        IdentifierFormatIsNotAllowed(name);
      }
      if (!identifierIsReference(node, parent)) {
        return;
      }
      const ctx = context.map.get(name);
      const dep = replacementInfo.map.get(name);
      const esParent = getEsNodeOfParent(parent);
      if (!dep && /^(?:prop|ref)s$/.test(name)) {
        useGetter = true;
        return;
      }
      if (is(esParent?.v, "ObjectProperty") && esParent.v.shorthand) {
        extendTransformInfo(node.start, `${name}: `);
      }
      if (ctx) {
        useGetter = true;
        useContext = true;
        if (type === "directive") {
          if (!isKeyDirective) {
            extendTransformInfo(end, ctx.to);
          } else {
            extendTransformInfo(end, ctx.pto);
          }
          expEliminateRanges.add([start, end]);
        } else {
          contextVariables.push(`${name} = ${ctx.to}`);
        }
      } else if (dep) {
        dep.status = "rea";
        if (dep.useDollar) {
          useGetter = true;
          extendTransformInfo(end, ".$");
          {
            extendTransformInfo(start, "_w_");
          }
        }
      }
    },
    CallExpression(node) {
      useGetter = true;
      if (isEvent) {
        const callee = node.callee;
        useContext = true;
        extendTransformInfo(callee.start, "ctx(");
        afterWalkFuncs.push(() => {
          extendTransformInfo(callee.end, ")");
        });
      }
    },
    // 标记需要记录sourcemap信息的索引（这里值表达式转换前的索引，转换完成后，
    // 可以通过访问indexMap[转换前的索引]来换取它对应的转换后的表达式位置索引
    AnyNode(node) {
      if (startIndex !== -1) {
        sourcemapIndexes.push(node.start - 2, node.end - 2);
      }
    }
  });
  runAll(afterWalkFuncs);
  if (!useGetter) {
    useGetter = isEvent || expressionMaybeFunction(ast);
  }
  for (let i = 0, offset = 0, nextOffset = 0, rsc = 0, pie = false; i <= expression.length; i++) {
    transformInfos.get(i)?.forEach((str) => {
      transformedArr.push(str);
      if (str === "_w_") {
        nextOffset += 3;
      } else {
        offset += str.length;
      }
    });
    if (i < expression.length) {
      if (isIndexEliminated(i + 2, expEliminateRanges) || rsc > 0) {
        rsc > 0 && rsc--;
        pie && offset--;
        pie = true;
      } else {
        const matched = expressionReplaceWithSpaceRE.exec(expression);
        if (matched) {
          transformedArr.push(" ");
          rsc = matched[0].length - 1;
        } else {
          transformedArr.push(expression[i]);
        }
        if (pie) {
          offset--;
        }
        pie = false;
      }
    }
    expressionReplaceWithSpaceRE.lastIndex = i + 1;
    indexMap.push(i + offset);
    offset += nextOffset;
    nextOffset = 0;
  }
  let addedPrefixLen = 0;
  let transformedExp = transformedArr.join("");
  const useParenthesesWrap = /^ *{/.test(transformedExp);
  const useInlineEventHandler = isEvent && isInlineEventHandler(ast);
  if (contextVariables.length) {
    const cvds = `const ${contextVariables.join(", ")};`;
    transformedExp = `{ ${cvds} return ${transformedExp} }`;
    addedPrefixLen += cvds.length + 10;
  }
  if (useInlineEventHandler) {
    const paramStr = isComponentEvent ? "param" : "event";
    transformedExp = `${paramStr} => ${transformedExp}`;
    addedPrefixLen += paramStr.length + 4;
  }
  if (optionalParams.eventWrapperFlag) {
    const flag = optionalParams.eventWrapperFlag;
    const eventWrapperFuncName = getAlias("eventWradpper");
    addedPrefixLen += eventWrapperFuncName.length + 1;
    transformedExp = `${eventWrapperFuncName}(${transformedExp}, ${flag})`;
  }
  if (!optionalParams.usedAsSetter && useGetter) {
    const paramStr = useContext ? "ctx" : "_";
    if (useParenthesesWrap) {
      addedPrefixLen += 1;
      transformedExp = `(${transformedExp})`;
    }
    addedPrefixLen += (useContext ? 3 : 1) + 4;
    transformedExp = `${paramStr} => ${transformedExp}`;
  }
  if (useGetter) {
    sourcemapIndexes.forEach((index) => {
      const sourceIndex = noPositionMap ? index + startIndex : optionalParams.positionMap[index];
      const generateIndex = indexMap[index] + addedPrefixLen;
      if (!isUndefined(sourceIndex)) {
        mappings.push([
          sourceIndex,
          generateIndex,
          inputDescriptor.positions[sourceIndex].line,
          inputDescriptor.positions[sourceIndex].column
        ]);
      }
    });
    if (contextVariables.length && mappings[0]) {
      mappings[0][1] = addedPrefixLen - 7;
    }
  }
  return mappings.length ? { mappings, transformedExp } : transformedExp;
}
function isInlineEventHandler(node) {
  return !(isFunctionNode(node) || is(node, "Identifier") || is(node, "MemberExpression") || is(node, "OptionalMemberExpression"));
}
function expressionMaybeFunction(exp) {
  const esExp = getEsNode(exp);
  return !(is(esExp, "NullLiteral") || is(esExp, "RegexLiteral") || is(esExp, "BigIntLiteral") || is(esExp, "StringLiteral") || is(esExp, "BooleanLiteral") || is(esExp, "DecimalLiteral") || is(esExp, "NumericLiteral") || is(esExp, "TemplateLiteral") || is(esExp, "UnaryExpression") || is(esExp, "ArrayExpression") || is(esExp, "ObjectExpression") || is(esExp, "BinaryExpression") || is(esExp, "UpdateExpression"));
}

function analyzeAttribute(tag, isComponent, parentIsComponent, attrs, context, continueByDirective, awaitContextStartIndex) {
  let slot = "";
  let slotName = "";
  let pureKey;
  let insertNullNum = 0;
  let withAwait = false;
  let createTemplate = false;
  let forModuleFuncIndex = -1;
  let continueArg;
  let continueRE = null;
  let continuedDirective;
  const isSlot = tag === "slot";
  const aliasArgs = [];
  const directiveStu = [];
  const eventStu = [];
  const attributeStu = [];
  const filteredAttrs = filterDuplicateAttr(attrs, tag, isComponent);
  filteredAttrs.forEach((attr) => {
    const { key, value } = attr;
    const [rk, rv] = [key.raw, value.raw];
    const trimedValue = rv.trim();
    const isRef = rk.startsWith("&");
    const isEvent = rk.startsWith("@");
    const isDynamic = rk.startsWith("!");
    const isDirective = rk.startsWith("#");
    const teOptionalParam = { usedAsSetter: true };
    const valueStartIndex = attr.value.loc.start.index;
    const isExpression = isEvent || isDynamic || isDirective || isRef;
    const transDirective = (exp, option) => {
      return transformExpression(exp, -1, context, "directive", option);
    };
    const transAttrValue = (exp, option) => {
      if (!option) {
        option = {
          positionMap: attr.positionMap
        };
      } else {
        option.positionMap = attr.positionMap;
      }
      const res = transformExpression(exp, valueStartIndex, context, "attribute", option);
      return isString(res) ? res : res.transformedExp;
    };
    pureKey = isExpression ? rk.slice(1) : rk;
    if (isComponent) {
      pureKey = kebab2Camel(pureKey);
    }
    if (isRef) {
      if (pureKey === "slot") {
        InvalidSlotAttribute(2);
      }
      if (isSlot && pureKey === "name") {
        InvalidSlotNameAttribute(2);
      }
      if (!couldUseRefTags.has(tag) && !isComponent) {
        CouldNotPassRefValue(pureKey, tag);
      }
      const teWithGetter = transAttrValue(rv);
      const teWithoutGetter = transAttrValue(rv, teOptionalParam);
      if (isComponent) {
        eventStu.push(stringify(pureKey));
        eventStu.push(`[${teWithGetter}, v => (${teWithoutGetter} = ${value.raw} = v)]`);
      } else {
        let listenEventName = "input";
        let reactiveProperty = "value";
        const [typeAttr] = filteredAttrs.filter((attr2) => {
          return attr2.key.raw.endsWith("type");
        });
        if (pureKey !== "auto") {
          GeneralTagJustAcceptAutoAsReference(tag);
        }
        if (typeAttr?.key.raw.startsWith("!")) {
          ReferenceValueCantBeUsedWithDynamicType(tag);
        }
        const isSelectTag = tag === "select";
        const isSpecialTypeForInput = /^"(?:checkbox|radio)"$/.test(typeAttr?.value.raw);
        if (isSelectTag) {
          listenEventName = "change";
        }
        if (tag === "input" && isSpecialTypeForInput) {
          listenEventName = "change";
          reactiveProperty = "checked";
        }
        const setterStr = `v => (${teWithoutGetter} = v)`;
        const listenEventNameStr = stringify(listenEventName);
        const withReferenceFuncName = getAlias("withReference");
        attributeStu.push(stringify(reactiveProperty), teWithGetter);
        eventStu.push("", `...${withReferenceFuncName}(${listenEventNameStr}, ${setterStr})`);
      }
    } else if (isDirective) {
      switch (pureKey) {
        case "for":
          const preContextCount = context.count || 0;
          const inKeywordIndex = findOutOfSC(trimedValue, / in /);
          const hasContextIdentifier = inKeywordIndex !== -1;
          const contextStr = trimedValue.slice(0, inKeywordIndex).trim();
          const forBasedValue = hasContextIdentifier ? trimedValue.slice(inKeywordIndex + 4).trim() : trimedValue;
          const transformedForBaseValue = transDirective(forBasedValue);
          context.count = preContextCount + 2;
          forModuleFuncIndex = directiveStu.length;
          if (hasContextIdentifier) {
            let item, index;
            const itemWithDestructuring = /^[{\[]/.test(contextStr);
            const indexWithDestructuring = /[}\]]$/.test(contextStr);
            if (!itemWithDestructuring && !indexWithDestructuring) {
              [item, index] = contextStr.split(",").map((s) => s.trim());
            } else {
              item = findForItemDestructuringStr(contextStr);
              index = contextStr.slice(item.length).replace(/ *, */, "");
            }
            if (!indexWithDestructuring) {
              checkIdentifierName(index);
              extendContext(context, index, preContextCount);
            } else {
              recordAliasIdentifiers(index, context, aliasArgs, 0);
            }
            if (!itemWithDestructuring) {
              checkIdentifierName(item);
              extendContext(context, item, preContextCount + 1);
            } else {
              recordAliasIdentifiers(item, context, aliasArgs, 1);
            }
          }
          directiveStu.push([getAlias("forModule"), transformedForBaseValue]);
          break;
        case "key":
          if (forModuleFuncIndex === -1) {
            UsedKeyDirectiveWithoutForDirective();
          } else {
            const teOptionalParam2 = { isKeyDirective: true };
            const transformedExp = transDirective(rv, teOptionalParam2);
            directiveStu[forModuleFuncIndex][0] = getAlias("keyedForModule");
            directiveStu[forModuleFuncIndex].push(transformedExp);
          }
          break;
        case "if":
        case "elif":
        case "else":
          if (pureKey === "else") {
            continueArg = "1";
          } else {
            const transformedExp = transDirective(rv);
            if (pureKey === "elif") {
              continueArg = transformedExp;
            } else {
              createTemplate = true;
              directiveStu.push([getAlias("ifModule"), transformedExp]);
            }
            continueRE = /^#(?:elif|else)$/;
          }
          if (pureKey !== "if" && isUndefined(continueByDirective)) {
            MissingStartDirective(rk, "#if");
          }
          continuedDirective = pureKey;
          break;
        case "then":
        case "catch":
        case "await":
          if (pureKey === "await") {
            const transformedExp = transDirective(rv);
            directiveStu.push([getAlias("awaitModule"), transformedExp]);
            continueRE = /^#(?:then|catch)$/;
            createTemplate = true;
            withAwait = true;
          } else {
            const withDestructuring = /^[{\[]/.test(rv);
            if (isUndefined(continueByDirective) && !withAwait) {
              MissingStartDirective(rk, "#await");
            }
            context.count++;
            if (isUndefined(awaitContextStartIndex)) {
              awaitContextStartIndex = context.count;
            }
            if (!withDestructuring) {
              checkIdentifierName(rv);
              extendContext(context, rv, awaitContextStartIndex);
            } else {
              recordAliasIdentifiers(rv, context, aliasArgs, awaitContextStartIndex);
            }
            if (withAwait) {
              if (pureKey === "catch") {
                insertNullNum = 2;
                continueRE = null;
              } else {
                insertNullNum = 1;
              }
            }
            if (pureKey === "then") {
              continueRE = /^#catch$/;
            }
          }
          if (continueByDirective === "await" && pureKey === "catch") {
            insertNullNum = 1;
          }
          continuedDirective = pureKey;
          break;
      }
    } else if (isEvent) {
      if (isSlot) {
        InvalidEventForSlot(rk);
      } else {
        let eventFlag = 0;
        let eventName = pureKey;
        let eventWrapperFlag = 0;
        const flagIndex = pureKey.indexOf("|");
        if (flagIndex !== -1) {
          if (isComponent) {
            const flagStr = pureKey.slice(flagIndex + 1);
            InvalidEventFlagForComponent(flagStr);
          } else {
            const flagStr = pureKey.slice(flagIndex);
            const flagArr = flagStr.split("|").slice(1);
            flagArr.forEach((key2) => {
              const currentFlagNum = EventListenerFlag[key2];
              const currentWrapperFlagNum = EventWrapperFlag[key2];
              if (!currentFlagNum && !currentWrapperFlagNum) {
                InvalidEventFlag(key2, eventName);
              }
              if (currentFlagNum) {
                eventFlag |= currentFlagNum || 0;
              } else if (currentWrapperFlagNum) {
                eventWrapperFlag |= currentWrapperFlagNum || 0;
              }
            });
          }
          eventName = pureKey.slice(0, flagIndex);
        }
        if (isComponent) {
          const transformedExp = transAttrValue(rv, {
            isComponentEvent: true
          });
          attributeStu.push(stringify(eventName), transformedExp);
        } else {
          const transformedExp = transAttrValue(rv, {
            eventWrapperFlag
          });
          eventStu.push(stringify(eventName), `${transformedExp}, ${eventFlag}`);
        }
      }
    } else {
      if (parentIsComponent && pureKey === "slot") {
        if (!isDynamic) {
          if (rv !== '""') {
            slot = rv;
          } else {
            SlotAttributeIsEmpty();
          }
        } else {
          InvalidSlotAttribute(1);
        }
      } else if (isSlot && pureKey === "name") {
        if (!isDynamic) {
          if (rv !== '""') {
            slotName = rv;
          } else {
            SlotNameAttributeIsEmpty();
          }
        } else {
          InvalidSlotNameAttribute(1);
        }
      } else {
        attributeStu.push(stringify(pureKey));
        if (isExpression) {
          attributeStu.push(transAttrValue(rv));
        } else {
          attributeStu.push(normalStringify(rv));
        }
      }
    }
  });
  if (aliasArgs.length) {
    directiveStu.push([getAlias("aliasModule"), ...aliasArgs]);
  }
  return {
    slot,
    slotName,
    eventStu,
    directiveStu,
    attributeStu,
    continueRE,
    continueArg,
    insertNullNum,
    createTemplate,
    continuedDirective,
    awaitContextStartIndex
  };
}
function filterDuplicateAttr(attributes, tag, isComponent) {
  let dynamicClassIndex = -1;
  let normalClassIndex = -1;
  let ifRelatedDirectivesCoexistState = "";
  let awiatRelatedDirectivesCoexistState = "";
  const ret = [];
  const isComponentOrSlot = isComponent || tag === "slot";
  const existingItem = /* @__PURE__ */ new Map();
  for (let i = 0; i < attributes.length; i++) {
    const { key, value, loc } = attributes[i];
    const [rk, rv] = [key.raw, value.raw];
    const isNative = /^[^@!#&]/.test(rk);
    const isDynamic = /^[!&]/.test(rk);
    const isEvent = rk.startsWith("@");
    const isDirective = rk.startsWith("#");
    const isClass = /^[!&]?class/.test(rk);
    const pureKey = isNative ? rk : rk.slice(1);
    if (isNative) {
      value.raw = normalStringify(rv);
    }
    if (isEvent || isDynamic || isDirective) {
      if (!pureKey) {
        EmptyAttributeName(rk[0]);
      }
    }
    if (isEvent) {
      if (value) {
        ret.push({ loc, key, value });
      } else {
        NoValueForRequiredValueAttribute(rk, 2);
      }
      continue;
    }
    if (isDirective) {
      if (mustPassValueDirectives.has(pureKey) && !value) {
        NoValueForRequiredValueAttribute(rk, 1);
      }
      if (/^#(?:if|elif|else)$/.test(rk)) {
        if (!ifRelatedDirectivesCoexistState) {
          ifRelatedDirectivesCoexistState = rk;
        } else {
          DirectivesCantCoexist([ifRelatedDirectivesCoexistState, rk]);
        }
      }
      if (/^#(?:then|catch)$/.test(rk)) {
        if (!awiatRelatedDirectivesCoexistState) {
          awiatRelatedDirectivesCoexistState = rk;
        } else {
          DirectivesCantCoexist([awiatRelatedDirectivesCoexistState, rk]);
        }
      }
    }
    if (isDynamic && !value) {
      NoValueForRequiredValueAttribute(rk, rk.startsWith("!") ? 3 : 4);
    }
    if (isDirective || !isClass || isComponentOrSlot) {
      if (existingItem.has(pureKey) || existingItem.has("!" + pureKey) || existingItem.has("&" + pureKey)) {
        existingItem.delete(pureKey);
        if (!isDirective) {
          existingItem.delete("!" + pureKey);
          existingItem.delete("&" + pureKey);
        }
        DuplicateAttributeKey(tag, pureKey, isDirective);
      }
      existingItem.set(rk, [attributes[i]]);
      continue;
    }
    if (isClass && !isComponentOrSlot) {
      if (!existingItem.has("!class")) {
        existingItem.set("!class", []);
      }
      const target = existingItem.get("!class");
      if (isDynamic) {
        if (rk.startsWith("&")) {
          CouldNotPassRefValue(pureKey, tag);
        }
        if (dynamicClassIndex !== -1) {
          target[dynamicClassIndex] = attributes[i];
          DuplicateAttributeKey(tag, rk, false);
        } else {
          dynamicClassIndex = target.push(attributes[i]) - 1;
        }
      } else {
        if (normalClassIndex !== -1) {
          target[normalClassIndex] = attributes[i];
          DuplicateAttributeKey(tag, pureKey, isDirective);
        } else {
          normalClassIndex = target.push(attributes[i]) - 1;
        }
      }
    }
  }
  existingItem.forEach((attrItems, attrKey) => {
    if (isComponentOrSlot || attrKey !== "!class") {
      ret.push(attrItems[0]);
    } else {
      const rawValues = attrItems.map((item) => {
        return item.value.raw;
      });
      const transformedValue = rawValues.join(", ");
      const positionMap = [];
      {
        let dynamicStartIndex = 1;
        if (dynamicClassIndex === 1) {
          dynamicStartIndex += attrItems[0].value.raw.length + 2;
        }
        if (dynamicClassIndex !== -1) {
          const dynamicValueLoc = attrItems[dynamicClassIndex].value.loc;
          for (let i = 0; i <= rawValues[dynamicClassIndex].length; i++) {
            positionMap[dynamicStartIndex + i] = dynamicValueLoc.start.index + i;
          }
        }
      }
      ret.push({
        loc: attrItems[0].loc,
        key: {
          raw: attrKey,
          loc: attrItems[0].key.loc
        },
        value: {
          raw: `[${transformedValue}]`,
          loc: attrItems[0].value.loc
        },
        positionMap: positionMap.length ? positionMap : void 0
      });
    }
  });
  return ret.sort((a, b) => {
    const o = [
      "key",
      "for",
      "else",
      "elif",
      "if",
      "then",
      "catch",
      "await"
    ];
    const [ak, bk] = [a.key.raw, b.key.raw];
    const oa = o.reduce((p, c, i) => {
      return { ...p, [`#${c}`]: i + 1 };
    }, {});
    return (oa[bk] || 0) - (oa[ak] || 0);
  });
}
function findForItemDestructuringStr(s) {
  let sc = 0;
  let res = "";
  if (!/^[{[]/.test(s)) {
    const commaIndex = s.indexOf(",");
    return s.slice(0, commaIndex);
  }
  const charMap = {
    "{": "}",
    "[": "]"
  };
  const startChar = s[0];
  const slash = startChar === "[" ? "\\" : "";
  const endChar = charMap[startChar];
  const restr = `[${slash}${startChar}${slash}${endChar}]`;
  do {
    const index = findOutOfSC(s, new RegExp(restr));
    const isStartChar = s[index] === startChar;
    if (index === -1) {
      break;
    }
    res += s.slice(0, index + 1);
    sc += isStartChar ? 1 : -1;
    s = s.slice(index + 1);
  } while (sc);
  return res;
}
function recordAliasIdentifiers(source, context, aliasArgs, baseCtxIndex) {
  const shouldRecordPath = !isUndefined(baseCtxIndex);
  const ast = parse(source = `const ${source}={}`).body[0];
  const declarators = ast.declarations;
  declarators.forEach((declarator) => {
    const identifiers = [];
    const baseValue = `ctx(${baseCtxIndex})`;
    const pattern = declarator.id;
    const patternSource = source.slice(pattern.start, pattern.end);
    if (!shouldRecordPath) {
      getIdentifiersFromPattern(pattern).forEach((from) => {
        identifiers.push(from);
        extendContext(context, from, -1);
      });
    } else {
      getIdentifiersFromPatternWithPath(source, pattern).forEach((path, from) => {
        identifiers.push(from);
        extendContext(context, from, -1, `${baseValue}${path}`);
      });
    }
    aliasArgs.push(`ctx => ${baseValue}`, `(${patternSource}) => [${identifiers.join(", ")}]`);
  });
}
function extendContext(context, from, index, pathTo) {
  const useCount = index === -1;
  const to = `ctx(${useCount ? context.count++ : index})`;
  if (!pathTo) {
    context.map.set(from, { to });
  } else {
    context.map.set(from, { to, pto: pathTo });
  }
}

function content2script(content, startSourceIndex) {
  let rc = 0;
  let index = 0;
  let last = content;
  let transformedStrLen = 0;
  let contentSourceIndex = 0;
  const positionMap = [];
  const transformedArr = [];
  const { positions } = inputDescriptor;
  const pushTransformedArr = (str, useStringify = true) => {
    const sourceIndex = startSourceIndex + contentSourceIndex;
    if (useStringify) {
      const stringified = normalStringify(str);
      {
        const stringifiedLen = stringified.length;
        const endIndex = transformedStrLen + stringifiedLen;
        positionMap[transformedStrLen] = positions[sourceIndex].index;
        positionMap[endIndex] = positions[sourceIndex + str.length].index;
        transformedStrLen = endIndex + 3;
      }
      transformedArr.push(stringified);
    } else {
      if (!str.length) {
        EmptyInterpolationExpression();
      }
      {
        for (let i = 0; i <= str.length; i++) {
          const charSourceIndex = positions[sourceIndex + i + 1].index;
          positionMap[transformedStrLen + i + 1] = charSourceIndex;
        }
        transformedStrLen += str.length + 5;
        contentSourceIndex += 2;
      }
      transformedArr.push(`(${str})`);
    }
    contentSourceIndex += str.length;
  };
  while (last) {
    if ((index = last.indexOf("{")) === -1) {
      pushTransformedArr(last, true);
      break;
    }
    if (index !== 0) {
      pushTransformedArr(last.slice(0, index));
    }
    last = last.slice(index + 1);
    index = 0;
    rc++;
    while (true) {
      const bracketIndex = findOutOfSC(last.slice(index), /[{}]/);
      if (bracketIndex === -1) {
        UnclosedInterpolationExpression();
      }
      index += bracketIndex;
      rc = last[index] === "{" ? rc + 1 : rc - 1;
      if (rc === 0) {
        pushTransformedArr(last.slice(0, index), false);
        last = last.slice(index + 1);
        break;
      }
      index++;
    }
  }
  return {
    positionMap,
    script: transformedArr.join(" + ") || normalStringify("")
  };
}

function analyzeTemplate(nodes, parentIsComponent = false, context, continueByDirective, awaitContextStartIndex) {
  const result = [];
  for (let i = 0; i < nodes.length; i++) {
    let trimedContentStartIndex = 0;
    let currentContext;
    let { tag, content, attributes, children } = nodes[i];
    let shouldHoistContent = children.length === 1 && children[0].tag === "";
    const isSlot = tag === "slot";
    const isComponent = tagIsComponentRE.test(tag);
    const currentRet = {
      aar: null,
      tag: "",
      content: "",
      children: []
    };
    result.push(currentRet);
    shouldHoistContent &&= !isComponent && !isSlot;
    if (!isComponent) {
      currentRet.tag = stringify(tag);
    } else {
      currentRet.tag = kebab2Camel(tag, true);
    }
    if (isUndefined(context)) {
      currentContext = context = {
        count: 0,
        map: /* @__PURE__ */ new Map()
      };
    } else {
      currentContext = cloneContext(context);
    }
    if (!attributes.length) {
      if (parentIsComponent) {
        currentRet.aar = {
          eventStu: [],
          directiveStu: [],
          attributeStu: [],
          slot: stringify("default")
        };
      }
    } else {
      let continueRE;
      let curContinuedDirective;
      const contextBeforeAnalyzeAttribute = cloneContext(currentContext);
      const aar = analyzeAttribute(
        tag,
        isComponent,
        parentIsComponent,
        attributes,
        currentContext,
        continueByDirective,
        awaitContextStartIndex
      );
      currentRet.aar = aar;
      continueRE = aar.continueRE;
      curContinuedDirective = aar.continuedDirective;
      if (parentIsComponent && !aar.slot) {
        aar.slot = stringify("default");
      }
      if ((!isNull(aar.continueRE) || aar.insertNullNum) && aar.createTemplate) {
        const useBracketWrap = shouldUseBracketWrap(tag, aar);
        const awaitNullChildTempl = { tar: null, useBracket: false };
        const mockTemplateRet = {
          tag: "template",
          content: "",
          aar: {
            slot: aar.slot,
            eventStu: [],
            attributeStu: [],
            directiveStu: aar.directiveStu.slice(0, 1)
          },
          children: [
            {
              tar: currentRet,
              useBracket: useBracketWrap
            }
          ]
        };
        aar.slot = "";
        result.pop();
        result.push(mockTemplateRet);
        aar.directiveStu = aar.directiveStu.slice(1);
        if (aar.insertNullNum) {
          for (let i2 = 0; i2 < aar.insertNullNum; i2++) {
            mockTemplateRet.children.unshift(awaitNullChildTempl);
          }
        }
        while (shouldContinue(nodes[i + 1], continueRE)) {
          const cotinueContext = cloneContext(contextBeforeAnalyzeAttribute);
          const [childTemplateAnalysisRet] = analyzeTemplate(
            [nodes[++i]],
            isComponent,
            cotinueContext,
            curContinuedDirective,
            aar.awaitContextStartIndex
          );
          const useBracketWrap2 = shouldUseBracketWrap(
            nodes[i].tag,
            childTemplateAnalysisRet.aar
          );
          const childAarContinueArg = childTemplateAnalysisRet.aar.continueArg;
          if (childTemplateAnalysisRet.aar?.insertNullNum) {
            mockTemplateRet.children.push(awaitNullChildTempl);
          }
          if (childAarContinueArg) {
            mockTemplateRet.aar.directiveStu[0].push(childAarContinueArg);
          }
          mockTemplateRet.children.push({
            useBracket: useBracketWrap2,
            tar: childTemplateAnalysisRet
          });
          continueRE = childTemplateAnalysisRet.aar?.continueRE;
          curContinuedDirective = childTemplateAnalysisRet.aar?.continuedDirective;
        }
      }
    }
    if (tag !== "pre") {
      if (!shouldHoistContent) {
        trimedContentStartIndex = nodes[i].range[0];
      } else {
        content = children[0].content;
        trimedContentStartIndex = children[0].range[0];
      }
      const preSpaceCount = /^\s*/.exec(content)?.[0].length || 0;
      content = content.slice(preSpaceCount).trimEnd();
      trimedContentStartIndex += preSpaceCount;
    }
    if (currentRet.aar?.slotName) {
      currentRet.content = currentRet.aar.slotName;
    } else if (tag === "!") {
      currentRet.content = normalStringify(content);
    } else {
      const parseRet = content2script(content, trimedContentStartIndex);
      const teOptionalParam = { positionMap: parseRet.positionMap };
      currentRet.content = transformExpression(
        parseRet.script,
        trimedContentStartIndex,
        currentContext,
        "content",
        teOptionalParam
      );
    }
    if (!shouldHoistContent) {
      const existingSlotValues = /* @__PURE__ */ new Set();
      analyzeTemplate(children, isComponent, currentContext).forEach((childRet) => {
        const slot = childRet.aar?.slot;
        if (slot) {
          if (existingSlotValues.has(slot)) {
            DuplicateSlotAttributeValue(slot);
          }
          existingSlotValues.add(slot);
        }
        currentRet.children.push({
          tar: childRet,
          useBracket: Boolean(slot)
        });
      });
    }
  }
  return result;
}
function shouldContinue(node, re) {
  if (isUndefined(node) || !re) {
    return false;
  }
  return node.attributes.some((attr) => {
    return re.test(attr.key.raw);
  });
}
function shouldUseBracketWrap(tag, aar) {
  const removeBrackWrapFuncNames = /* @__PURE__ */ new Set([
    getAlias("forModule", false),
    getAlias("aliasModule", false)
  ]);
  return templateTag.test(tag) && !removeBrackWrapFuncNames.has(lastElem(aar.directiveStu)?.[0]);
}
function cloneContext(context) {
  return {
    count: context.count,
    map: new Map(context.map)
  };
}

class MinHeap {
  tree = [];
  keys;
  constructor(init, ...sortKeys) {
    init.forEach((item, index) => {
      this.tree.push(item);
      this.up(index);
    });
    this.keys = sortKeys;
  }
  get first() {
    return this.tree[0];
  }
  get size() {
    return this.tree.length;
  }
  fetch() {
    const { tree } = this;
    const first = this.first;
    const last = tree.pop();
    if (last && last !== first) {
      tree[0] = last;
      this.down(0);
    }
    return first;
  }
  insert(value) {
    const { tree } = this;
    tree.push(value);
    this.up(tree.length - 1);
  }
  up(index) {
    const { tree, compare } = this;
    while (index !== 0) {
      const middle = (index - 1) / 2 | 0;
      if (compare(index, middle) === "lt") {
        [tree[index], tree[middle]] = [tree[middle], tree[index]];
        index = middle;
      } else {
        break;
      }
    }
  }
  down(index) {
    const { tree, compare, size } = this;
    const lastHasLeafIndex = (size - 2) / 2 | 0;
    if (size === 1 || index > lastHasLeafIndex) {
      return;
    }
    while (index <= lastHasLeafIndex) {
      let minIndex;
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      if (rightIndex > size - 1) {
        minIndex = leftIndex;
      } else {
        if (compare(leftIndex, rightIndex) === "lt") {
          minIndex = leftIndex;
        } else {
          minIndex = rightIndex;
        }
      }
      if (compare(index, minIndex) !== "gt") {
        break;
      }
      [tree[index], tree[minIndex]] = [tree[minIndex], tree[index]];
      index = minIndex;
    }
  }
  compare = (a, b) => {
    const { tree, keys } = this;
    for (const key of keys) {
      const v1 = tree[a][key];
      const v2 = tree[b][key];
      if (v1 < v2) {
        return "lt";
      } else if (v1 > v2) {
        return "gt";
      }
    }
    return "eq";
  };
}

function transformScript(source, indentN = 0) {
  const transformedArr = [];
  const existingReplacementItem = /* @__PURE__ */ new Set();
  const heap = new MinHeap([], "index", "order", "id");
  replacementInfo.map.forEach((repl, identifier) => {
    if (repl.status === "rea") {
      repl.items.forEach((item) => {
        if (!existingReplacementItem.has(item)) {
          heap.insert(item);
          existingReplacementItem.add(item);
        }
      });
      if (repl.useDollar && compilerOptions.debugeMode) {
        if (!repl.createSetter) {
          debuggingInfo.constIdentifiers.add(identifier);
        } else {
          debuggingInfo.setters.set(identifier, debuggingInfo.setters.size);
        }
      }
    }
  });
  let mappingIndex = 0;
  let nextColumnOffset = 0;
  let replacementItem = heap.fetch();
  let eachColumnOffset = [];
  const recordColumnOffset = () => {
    const preColumnOffset = lastElem(eachColumnOffset) || 0;
    eachColumnOffset.push(preColumnOffset + nextColumnOffset);
    nextColumnOffset = 0;
  };
  for (let i = 0; i < source.length; i++) {
    const currentLoc = getScriptLoc(i);
    const currentColumn = eachColumnOffset.length;
    {
      if (mappingIndex !== currentLoc.line || i === source.length - 1) {
        const newLine = [];
        const oldLine = sourceMapInfo.mappings[mappingIndex];
        oldLine?.forEach((segment) => {
          const sourceColumn = segment[3];
          if (isUndefined(eachColumnOffset[sourceColumn])) {
            recordColumnOffset();
          }
          segment[0] += eachColumnOffset[sourceColumn];
          if (segment[0] !== lastElem(newLine)?.[0]) {
            newLine.push(segment);
          } else {
            newLine[newLine.length - 1] = segment;
          }
        });
        sourceMapInfo.mappings[mappingIndex] = newLine;
        if (i !== source.length - 1) {
          nextColumnOffset = 0;
          eachColumnOffset = [];
          mappingIndex = currentLoc.line;
        }
      }
      recordColumnOffset();
    }
    while (replacementItem && replacementItem.index === i) {
      const { text } = replacementItem;
      if (isString(text)) {
        if (/^\[?_w_$/.test(text)) {
          nextColumnOffset += text.length;
          eachColumnOffset[currentColumn] -= text.length;
        }
        transformedArr.push(text);
        eachColumnOffset[currentColumn] += text.length;
      } else {
        const textStr = text();
        transformedArr.push(textStr);
        eachColumnOffset[currentColumn] += textStr.length;
      }
      replacementItem.processed = true;
      while (replacementItem?.processed) {
        replacementItem = heap.fetch();
      }
    }
    if (isIndexEliminated(i, eliminateRanges)) {
      nextColumnOffset--;
      continue;
    }
    transformedArr.push(source[i]);
  }
  const joinedTransformedArr = transformedArr.join("");
  const indentSpaceCount = inputDescriptor.indentSpaceCount;
  const joinedTransformedPositions = getPositionOfEachChar(joinedTransformedArr);
  const transformedStr = joinedTransformedArr.replace(scriptSourceRedundantEmptyLine, (s, i) => {
    {
      let emptyLineCount = s.match(/\n/g).length;
      const startLine = joinedTransformedPositions[i].line;
      for (let j = +(i !== 0); emptyLineCount > 0; emptyLineCount--, j++) {
        sourceMapInfo.removedLine.add(startLine + j);
      }
    }
    return "";
  });
  if (!indentSpaceCount || !transformedStr) {
    return transformedStr;
  }
  return transformedStr.replace(scriptSourceNeedIndentPlace, () => {
    return `${indent(indentN)}`;
  });
}

const transformTemplateFlag = {
  useBracketWrap: 1 << 0,
  parentUseLineBreak: 1 << 1,
  notOverAfterEndBracket: 1 << 2
};
function transformTemplate(analysisRet, startLine, indentN = 0, flag = 1) {
  analysisRet?.forEach((item) => {
    if (isNull(item)) {
      return;
    }
    if (item.tag) {
      item.tag = confirmStringConstants(item.tag);
    }
    if (item.aar?.slot) {
      item.aar.slot = confirmStringConstants(item.aar.slot);
    }
    for (let i = 0; true; i += 2) {
      const estu = item.aar?.eventStu;
      const astu = item.aar?.attributeStu;
      if (!astu?.[i] && !estu?.[i]) {
        break;
      }
      if (!isUndefined(astu?.[i])) {
        astu[i] = confirmStringConstants(astu[i]);
      }
      if (!isUndefined(estu?.[i])) {
        estu[i] = confirmStringConstants(estu[i]);
      }
    }
  });
  const transformedArr = [];
  const useBracketWrap = vf(flag, "useBracketWrap");
  const useLineBreak = shouldUseLineBreak(analysisRet, true);
  const notOverAfterEndBracket = vf(flag, "notOverAfterEndBracket");
  const parentUseLineBreak = vf(flag, "parentUseLineBreak") || useLineBreak;
  let currentPosition;
  if (useBracketWrap && useLineBreak) {
    startLine++;
  }
  currentPosition = [startLine, 0];
  const pushTransformedArr = (...ters) => {
    for (const ter of ters) {
      const terIsString = isString(ter);
      const [currentLine, currentColumn] = currentPosition;
      const str = terIsString ? ter : ter.transformedExp;
      if (str !== "\n") {
        currentPosition[1] += str.length;
      } else {
        currentPosition = [currentLine + 1, 0];
      }
      if (!terIsString) {
        ter.mappings.forEach((item) => {
          const generatedColumn = item[1] + currentColumn;
          const generateLine = currentLine + inputDescriptor.script.loc.end.line + 3;
          recordMapping(generateLine, generatedColumn, item[2], item[3], item[0], true);
        });
      }
      transformedArr.push(str);
    }
  };
  analysisRet.forEach((item, index) => {
    let n = indentN;
    const isFirst = index === 0;
    const childrenLen = item?.children.length;
    const isLast = index === analysisRet.length - 1;
    if (useBracketWrap) {
      n++;
    }
    if (isNull(item)) {
      pushTransformedArr(getAlias("nil"), ",", "\n", indent(n));
      return;
    }
    const hasAar = !isNull(item.aar);
    const hasChild = childrenLen > 0;
    const isTemplate = templateTag.test(item.tag);
    const isContinued = hasAar && !isNull(item.aar.continueRE);
    const withEventStu = hasAar && item.aar.eventStu.length > 0;
    const elementUseLineBreak = shouldUseLineBreak(item, hasChild);
    const withDirectiveStu = hasAar && item.aar.directiveStu.length > 0;
    const withAttributeStu = hasAar && item.aar.attributeStu.length > 0;
    const withAttributeOrEventStu = withAttributeStu || withEventStu || hasChild;
    const elementUseIndent = isFirst && !withDirectiveStu && useBracketWrap && useLineBreak;
    const addTemplateStuJoinStr = (hasNext) => {
      if (hasNext) {
        pushTransformedArr(",");
        if (!elementUseLineBreak) {
          pushTransformedArr(" ");
        } else {
          pushTransformedArr("\n", indent(n + 1));
        }
      }
    };
    const addAttributeOrEventStu = (ters) => {
      const tersLen = ters.length;
      if (tersLen === 0) {
        return pushTransformedArr(getAlias("nil"));
      }
      let charCount = 0;
      const indentStr = indent(n + 2);
      for (const ter of ters) {
        charCount += getLengthOfTER(ter);
        if (charCount > 80) {
          break;
        }
      }
      pushTransformedArr("[");
      if (charCount <= 80) {
        ters.forEach((ter, index2) => {
          pushTransformedArr(ter);
          if (index2 !== tersLen - 1) {
            pushTransformedArr(", ");
          }
        });
      } else {
        ters.forEach((ter, index2) => {
          const wrap = index2 === 0 ? "\n" : "";
          const isLast2 = index2 === tersLen - 1;
          pushTransformedArr(wrap, indentStr, ter);
          if (!isLast2) {
            pushTransformedArr("\n");
          } else {
            pushTransformedArr(",", "\n", indent(n + 1));
          }
        });
      }
      pushTransformedArr("]");
    };
    if (withDirectiveStu) {
      const funcCount = item.aar.directiveStu.length;
      const funcArr = item.aar.directiveStu.reduce((pre, cur, funcIndex) => {
        const argArr = [];
        const isAliasModuleFunc = shouldArgUseBracket(cur[0]);
        if (isAliasModuleFunc) {
          argArr.push(`${indent(n++ + 1)}[`, "\n");
        }
        cur.slice(1).forEach((arg, argIndex) => {
          const isLastArg = argIndex === cur.length - 2;
          const useEndComma = isAliasModuleFunc && isLastArg;
          argArr.push(`${indent(n + 1)}${arg}${useEndComma ? "" : ","}`, "\n");
        });
        if (isAliasModuleFunc) {
          argArr.push(`${indent(n--)}],`, "\n");
        }
        if (funcIndex !== funcCount - 1) {
          argArr.push(indent(n + 1));
        }
        return n++, pre.concat([cur[0], "(", "\n"], argArr);
      }, []);
      if (isFirst && useBracketWrap) {
        pushTransformedArr(indent(n - funcCount));
      }
      pushTransformedArr(...funcArr, indent(n));
    }
    if (elementUseIndent) {
      pushTransformedArr(indent(n));
    }
    if (!isTemplate) {
      pushTransformedArr("[");
      if (elementUseLineBreak) {
        pushTransformedArr("\n", indent(n + 1));
      }
    }
    if (!isTemplate) {
      pushTransformedArr(item.tag);
      addTemplateStuJoinStr(true);
      pushTransformedArr(item.content);
      addTemplateStuJoinStr(withAttributeOrEventStu);
      if (withAttributeOrEventStu) {
        const hasEvent = withEventStu || hasChild;
        const eventStu = item.aar?.eventStu || [];
        const hasAttribute = withAttributeStu || hasEvent;
        const attributeStu = item.aar?.attributeStu || [];
        if (hasAttribute) {
          addAttributeOrEventStu(attributeStu);
          addTemplateStuJoinStr(hasEvent);
        }
        if (hasEvent) {
          addAttributeOrEventStu(eventStu);
          addTemplateStuJoinStr(hasChild);
        }
      }
    }
    if (childrenLen) {
      let waitForChunkEndIndex = 0;
      let chunkChildren = [];
      for (let i = 0; i < childrenLen; i++) {
        const child = item.children[i];
        const childIndentN = +(useLineBreak && !isTemplate) + n;
        if (child.useBracket) {
          chunkChildren = [child.tar];
        } else {
          const nextChild = item.children[i + 1];
          if (nextChild && !nextChild.useBracket) {
            continue;
          }
          const start = waitForChunkEndIndex;
          const end = waitForChunkEndIndex = i + 1;
          const partOfChildren = item.children.slice(start, end);
          chunkChildren = partOfChildren.map((child2) => child2.tar);
        }
        if (child.useBracket) {
          flag |= transformTemplateFlag.useBracketWrap;
        } else {
          flag &= ~transformTemplateFlag.useBracketWrap;
        }
        if (i !== item.children.length - 1) {
          flag |= transformTemplateFlag.notOverAfterEndBracket;
        } else {
          flag &= ~transformTemplateFlag.notOverAfterEndBracket;
        }
        if (elementUseLineBreak) {
          flag |= transformTemplateFlag.parentUseLineBreak;
        } else {
          flag &= ~transformTemplateFlag.parentUseLineBreak;
        }
        pushTransformedArr(
          transformTemplate(chunkChildren, currentPosition[0], childIndentN, flag)
        );
      }
    }
    if (!isTemplate) {
      if (elementUseLineBreak) {
        pushTransformedArr("\n", indent(n));
      }
      pushTransformedArr("]");
    }
    if (withDirectiveStu) {
      const funcCount = item.aar.directiveStu.length;
      for (let i = 0; i < funcCount; i++) {
        pushTransformedArr("\n", indent(--n), ")");
      }
    }
    if (!isLast) {
      pushTransformedArr(", ");
      if (parentUseLineBreak || isContinued) {
        pushTransformedArr("\n", indent(n));
      }
    }
  });
  const transformedStr = transformedArr.join("");
  if (!useBracketWrap) {
    return transformedStr;
  }
  const slot = analysisRet[0]?.aar?.slot;
  const retWrap = useLineBreak ? "\n" : "";
  const retWrapByParent = parentUseLineBreak ? "\n" : "";
  const retIndentStr = useLineBreak ? indent(indentN) : "";
  const retNextIndentStr = useLineBreak ? indent(indentN + 1) : "";
  const slotStr = slot ? `${retWrap}${retNextIndentStr}${slot}, ` : "";
  const retIndentStrByParent = parentUseLineBreak ? indent(indentN) : "";
  return `[${slotStr}${retWrap}${transformedStr}${retWrap}${retIndentStr}]${notOverAfterEndBracket ? `, ${retWrapByParent}${retIndentStrByParent}` : ""}`;
}
function getLengthOfTER(ter) {
  if (isString(ter)) {
    return ter.length;
  }
  return ter.transformedExp.length;
}
function vf(flag, key) {
  const item = transformTemplateFlag[key];
  return (flag & item) === item;
}
function shouldUseLineBreak(analysisRet, checkFuncStu = false, state = { count: 0 }) {
  if (state.count > 60) {
    return true;
  }
  if (!isArray(analysisRet)) {
    analysisRet = [analysisRet];
  }
  for (const item of analysisRet) {
    if (isNull(item)) {
      state.count += 2;
      continue;
    }
    const { tag, content, aar, children } = item;
    const tagLen = tag.length;
    const hasChild = children.length > 0;
    const contentLen = getLengthOfTER(content);
    const withFunc = aar && aar.directiveStu.length > 0;
    if (aar) {
      const keys = ["attributeStu", "eventStu", "directiveStu"];
      if (checkFuncStu && withFunc) {
        return true;
      }
      if (aar.slot) {
        state.count += aar.slot.length + 3;
      }
      for (const key of keys) {
        for (let stu of aar[key]) {
          if (!isArray(stu) || stu.length) {
            if (isArray(stu)) {
              for (const item2 of stu) {
                state.count += item2.length;
              }
            } else {
              state.count += getLengthOfTER(stu);
            }
            if (state.count > 60) {
              return true;
            }
          } else {
            state.count += 4;
          }
        }
      }
    }
    if (hasChild) {
      if (!aar) {
        state.count += 6;
      }
      for (const child of children) {
        if (shouldUseLineBreak(child.tar, checkFuncStu, state)) {
          return true;
        }
      }
    }
    state.count += tagLen + contentLen + 3;
  }
  return state.count > 60;
}
function confirmStringConstants(ter) {
  const transformedArr = [];
  const code = isString(ter) ? ter : ter.transformedExp;
  for (let startIndex = 0; true; ) {
    const [matchedIndex, matchedLen] = findOutOfSC(code, /_s\d+_/, startIndex);
    if (matchedIndex === -1) {
      transformedArr.push(code.slice(startIndex));
      break;
    }
    transformedArr.push(code.slice(startIndex, matchedIndex));
    const matchedStr = code.slice(matchedIndex, matchedIndex + matchedLen);
    const restoredStrLiteral = stringConstantsSourceMap.get(matchedStr);
    const currentStringConstant = stringConstants.get(restoredStrLiteral);
    if (currentStringConstant.count > 1 && restoredStrLiteral.length > 2) {
      transformedArr.push(matchedStr);
      currentStringConstant.using = true;
    } else {
      transformedArr.push(restoredStrLiteral);
    }
    startIndex = matchedIndex + matchedLen;
  }
  return transformedArr.join("");
}
function shouldArgUseBracket(funcName) {
  return funcName === getAlias("ifModule", false) || funcName === getAlias("aliasModule", false);
}

function compile(source, componentName) {
  const templateNodes = parseTemplate(source);
  const scriptSource = inputDescriptor.script.code;
  analyzeScript(scriptSource);
  const templateAnalysisRet = analyzeTemplate(templateNodes);
  const scriptTranformedRet = transformScript(scriptSource, 1);
  const templateTransformedRet = transformTemplate(templateAnalysisRet, 0, 2);
  const importStatements = generateImportStatements();
  const initCallStatement = generateInitCallStatement();
  return generateCompileResult(
    componentName,
    importStatements,
    initCallStatement,
    scriptTranformedRet,
    templateTransformedRet
  );
}
function generateImportStatements() {
  let joinStr = ",";
  let charCount = 0;
  let runtimeStr = "";
  let itemArr = [];
  let tempStoredImportStr = "";
  runtimeItems.forEach((item) => {
    itemArr.push(item);
    charCount += item.length;
  });
  itemArr.sort((a, b) => a.length - b.length);
  const itemStr = () => {
    return itemArr.join(joinStr);
  };
  if (charCount > 54) {
    joinStr += "\n" + indent();
    runtimeStr = `import {
${indent()}${itemStr()}
}`;
    sourceMapInfo.preaddedLineCount += itemArr.length + 1;
  } else {
    joinStr += " ";
    runtimeStr = `import { ${itemStr()} }`;
  }
  runtimeStr += ` from "qingkuai/internal"`;
  sourceMapInfo.tempStoredImportStartLine = sourceMapInfo.preaddedLineCount + 1;
  if (tempStoredImportInfos.length) {
    runtimeStr += "\n";
    tempStoredImportStr = tempStoredImportInfos.map((info) => info.code).join("\n");
    sourceMapInfo.preaddedLineCount += (tempStoredImportStr.match(/\n/g)?.length || 0) + 1;
  }
  return runtimeStr + tempStoredImportStr;
}
function generateInitCallStatement() {
  const itemArr = [];
  initItems.forEach((item) => {
    itemArr.push(item);
  });
  itemArr.push("props", "refs");
  return `const { ${itemArr.join(", ")} } = ${getAlias("init")}(this)`;
}
function generateCompileResult(componentName, importStatements, initCallStatement, scriptTranformedRet, templateTransformedRet) {
  let mappings = "";
  let debuggingStatementArr = [];
  const isTS = inputDescriptor.script.isTS;
  const setTemplateStructureFuncName = getAlias("setTemplateStructure");
  sourceMapInfo.columnOffsetOfFirstTemplateLine += inputDescriptor.indentSpaceCount * 2;
  sourceMapInfo.columnOffsetOfFirstTemplateLine += setTemplateStructureFuncName.length + 2;
  const stringConstantArr = [];
  stringConstants.forEach(({ value: variable, using }, literal) => {
    if (using) {
      stringConstantArr.push([variable, literal]);
    }
  });
  const stringConstantStr = stringConstantArr.reduce((pre, [k, v], i) => {
    sourceMapInfo.preaddedLineCount += i === 0 ? 3 : 1;
    return `${pre}
${indent(2)}const ${k} = ${v}`;
  }, "");
  {
    offsetSourcemap();
    mappings = encode(sourceMapInfo.mappings);
  }
  const postfix = `

${indent(2)}`;
  const withStringConstant = stringConstantArr.length > 0;
  const withScriptSourceCode = scriptTranformedRet !== "";
  const hasDebuggingSetter = debuggingInfo.setters.size > 0;
  const stringConstantsPostfix = withStringConstant ? postfix : "";
  const hasNonBeCalledSetter = debuggingInfo.constIdentifiers.size > 0;
  const scriptTransformedRetPostfix = withScriptSourceCode ? postfix : "";
  const stringLiteralComment = withStringConstant ? "// string literals area" : "";
  const scriptSourceComment = withScriptSourceCode ? "// javascript source code area\n" : "";
  if (hasDebuggingSetter || hasNonBeCalledSetter) {
    debuggingStatementArr.push(postfix, "// debugging setters area");
    debuggingInfo.setters.forEach((id, identifier) => {
      const setterFuncDeclaration = `function _d${id}_(v){ ${identifier} = v }`;
      debuggingStatementArr.push(`
${indent(2)}${setterFuncDeclaration}`);
    });
    if (hasNonBeCalledSetter) {
      debuggingStatementArr.push(`
${indent(2)}function _dn_(){`);
      debuggingInfo.constIdentifiers.forEach((identifier) => {
        debuggingStatementArr.push(` ${identifier};`);
      });
      debuggingStatementArr.push(" }");
    }
  }
  const code = `${importStatements}

export default class ${componentName} extends ${getAlias("QingKuaiComponent")}{
${indent(1)}constructor(args = {}){
${indent(2)}super(args)${postfix}${initCallStatement}${postfix}${stringLiteralComment}${stringConstantStr}${stringConstantsPostfix}${scriptSourceComment}${scriptTranformedRet}${scriptTransformedRetPostfix}// template structure area
${indent(2)}${setTemplateStructureFuncName}(${templateTransformedRet})${debuggingStatementArr.join("")}
${indent(1)}}
}`;
  return resetCompilerState(), { code, mappings, isTS };
}

export { compile };
