// 发布前剥离 package.json 中的 install 期生命周期脚本
// Strips install-time lifecycle scripts from package.json before publishing

import nodeFs from "node:fs"

import { readSync } from "../src/util/scripts/sundry"

const INSTALL_TIME_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"] as const

function stripInstallScripts() {
    const packageJson = JSON.parse(readSync("package.json"))
    const stripped: string[] = []
    for (const name of INSTALL_TIME_SCRIPTS) {
        if (packageJson.scripts?.[name] !== undefined) {
            delete packageJson.scripts[name]
            stripped.push(name)
        }
    }
    nodeFs.writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`)
    console.log(`Stripped install-time scripts: ${stripped.join(", ") || "(none)"}`)
}

stripInstallScripts()
