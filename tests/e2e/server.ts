import nodeFs from "node:fs"
import nodeHttp from "node:http"
import nodePath from "node:path"

import type { CompileOptions } from "../../src/types/compiler"
import { compile } from "../../src/compiler/index"
import { renderIndexPage, renderScenarioPage } from "./page-template"
import { e2eScenarios, getE2EScenario, isE2EScenarioName } from "./scenarios"

const workspaceDir = process.cwd()
const scenarioRoutePrefix = "/scenarios/"
const componentRoutePrefix = "components/"
const scenarioCodeCache = new Map<string, string>()
const componentCodeCache = new Map<string, string>()
const port = +(process.env.PLAYWRIGHT_PORT ?? "4173")
const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1"
const compileInDebugMode = process.env.COMPILE_MODE !== "non-debug"

const server = nodeHttp.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`)

    if (url.pathname === "/__health") {
        respondText(response, 200, "ok")
        return
    }

    if (url.pathname === "/") {
        respondHtml(response, renderIndexPage(e2eScenarios))
        return
    }

    if (url.pathname.startsWith("/dist/")) {
        serveStaticFile(response, safeResolve(workspaceDir, url.pathname))
        return
    }

    if (url.pathname.startsWith(scenarioRoutePrefix)) {
        const parsedScenarioRoute = parseScenarioRoute(url.pathname)
        if (!parsedScenarioRoute) {
            respondText(response, 404, `Unknown scenario: ${url.pathname}`)
            return
        }

        const { scenarioName, subPath } = parsedScenarioRoute

        if (!isE2EScenarioName(scenarioName)) {
            respondText(response, 404, `Unknown scenario: ${url.pathname}`)
            return
        }

        if (!subPath) {
            respondHtml(response, renderScenarioPage(getE2EScenario(scenarioName)))
            return
        }

        if (subPath === "app.js") {
            try {
                respondJavaScript(response, getScenarioCode(scenarioName))
            } catch (error) {
                respondText(response, 500, formatError(error))
            }
            return
        }

        if (subPath.startsWith(componentRoutePrefix)) {
            const componentPath = normalizeComponentKey(
                decodeURIComponent(subPath.slice(componentRoutePrefix.length))
            )
            try {
                respondJavaScript(response, getComponentCode(scenarioName, componentPath))
            } catch (error) {
                respondText(response, 500, formatError(error))
            }
            return
        }

        respondText(response, 404, `Not found: ${url.pathname}`)
        return
    }

    respondText(response, 404, `Not found: ${url.pathname}`)
})

server.listen(port, host, () => {
    console.log(`Playwright E2E server listening at http://${host}:${port}`)
})

function formatError(error: unknown) {
    if (error instanceof Error) {
        return error.stack ?? error.message
    }
    return String(error)
}

function getContentType(filePath: string) {
    switch (nodePath.extname(filePath)) {
        case ".css": {
            return "text/css; charset=utf-8"
        }
        case ".html": {
            return "text/html; charset=utf-8"
        }
        case ".js": {
            return "text/javascript; charset=utf-8"
        }
        case ".json": {
            return "application/json; charset=utf-8"
        }
        default: {
            return "application/octet-stream"
        }
    }
}
function getScenarioCode(name: string) {
    const cachedCode = scenarioCodeCache.get(name)
    if (cachedCode) {
        return cachedCode
    }

    const scenario = getE2EScenario(name)
    const code = compileSourceCodeOrThrow(scenario.input, scenario.compileOptions)
    scenarioCodeCache.set(name, code)
    return code
}

function getComponentCode(scenarioName: string, componentName: string) {
    const normalizedComponentName = normalizeComponentKey(componentName)
    const cacheKey = `${scenarioName}:${normalizedComponentName}`
    const cachedCode = componentCodeCache.get(cacheKey)
    if (cachedCode) {
        return cachedCode
    }

    const source = getScenarioComponentSource(scenarioName, normalizedComponentName)
    if (!source) {
        throw new Error(
            `Unknown component "${normalizedComponentName}" in scenario "${scenarioName}".`
        )
    }

    const code = compileSourceCodeOrThrow(source)
    componentCodeCache.set(cacheKey, code)
    return code
}

function getScenarioComponentSource(scenarioName: string, componentName: string) {
    const scenario = getE2EScenario(scenarioName)
    if (!scenario.components) {
        return undefined
    }

    for (const [rawKey, source] of Object.entries(scenario.components)) {
        if (normalizeComponentKey(rawKey) === componentName) {
            return source
        }
    }

    return undefined
}

function normalizeComponentKey(componentName: string) {
    return componentName
        .replace(/\\/g, "/")
        .replace(/^\.\//, "")
        .replace(/^\//, "")
        .replace(/\.js$/, "")
}

function parseScenarioRoute(pathname: string) {
    const pathAfterPrefix = pathname.slice(scenarioRoutePrefix.length)
    if (!pathAfterPrefix) {
        return undefined
    }

    const slashIndex = pathAfterPrefix.indexOf("/")
    const scenarioName = slashIndex === -1 ? pathAfterPrefix : pathAfterPrefix.slice(0, slashIndex)
    const subPath = slashIndex === -1 ? "" : pathAfterPrefix.slice(slashIndex + 1)
    return { scenarioName, subPath }
}

function compileSourceCodeOrThrow(source: string, options?: CompileOptions) {
    const result = compile(source, { debug: compileInDebugMode, ...options })
    const errors = result.messages.filter(item => item.type === "error")
    if (errors.length) {
        throw new Error(errors.map(item => `${item.value.code}: ${item.value.message}`).join("\n"))
    }
    return result.code
}

function safeResolve(rootDir: string, requestPath: string) {
    const resolvedPath = nodePath.resolve(rootDir, `.${requestPath}`)
    const normalizedRoot = `${nodePath.resolve(rootDir)}${nodePath.sep}`

    if (resolvedPath !== nodePath.resolve(rootDir) && !resolvedPath.startsWith(normalizedRoot)) {
        throw new Error(`Path is outside root: ${requestPath}`)
    }
    return resolvedPath
}

function serveStaticFile(response: nodeHttp.ServerResponse, filePath: string) {
    try {
        if (!nodeFs.existsSync(filePath)) {
            respondText(response, 404, `Missing static file: ${filePath}`)
            return
        }

        const content = nodeFs.readFileSync(filePath)
        response.writeHead(200, {
            "content-type": getContentType(filePath)
        })
        response.end(content)
    } catch (error) {
        respondText(response, 500, formatError(error))
    }
}

function respondHtml(response: nodeHttp.ServerResponse, content: string) {
    response.writeHead(200, {
        "content-type": "text/html; charset=utf-8"
    })
    response.end(content)
}

function respondJavaScript(response: nodeHttp.ServerResponse, content: string) {
    response.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8"
    })
    response.end(content)
}

function respondText(response: nodeHttp.ServerResponse, statusCode: number, content: string) {
    response.writeHead(statusCode, {
        "content-type": "text/plain; charset=utf-8"
    })
    response.end(content)
}
