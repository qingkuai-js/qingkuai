import fs from "fs-extra"
import path from "path"
import { fileURLToPath } from "url"
import { compile } from "../src/compiler"

const sourceInDevtoolTopComment = `\
/** 
 * This file will be shown with [.htm] extension name in devtool.
 * 
 * For better highlighting effect in devtool, we have to shown the
 * sourcemap of qingkuai component as an html file.
 * 
 * Other than the difference in the shown extension name, this will
 * have no impact on your development efforts.
 */\n
`

const dir = path.dirname(fileURLToPath(import.meta.url))

const templatePath = path.resolve(dir, "./qingkuai.html")
const templateSource = fs.readFileSync(templatePath, "utf-8")

console.time("compile")
const compileResult = compile(templateSource, "Test")
console.log(compileResult.code)
// console.log(compileResult.mappings)
console.timeEnd("compile")

// 生成sourcemap相关文件
const sourcemapPath = path.resolve(dir, "./sourcemap-test")
const gpath = path.resolve(sourcemapPath, "./g.js")
const spath = path.resolve(sourcemapPath, "./s.qk")
const mpath = path.resolve(sourcemapPath, "./s.js.map")
fs.removeSync(gpath)
fs.removeSync(spath)
fs.removeSync(mpath)
fs.writeFileSync(gpath, compileResult.code, "utf-8")
fs.writeFileSync(spath, templateSource, "utf-8")
fs.writeFileSync(
    mpath,
    JSON.stringify({
        version: 3,
        names: [],
        sources: ["s.qk"],
        mappings: compileResult.mappings,
        sourcesContent: [sourceInDevtoolTopComment + templateSource]
    }),
    "utf-8"
)
