import nodeFs from "node:fs"

type PackageJson = {
    version?: string
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function resolveReleaseNotes(changelog: string, version: string, tag: string): string {
    const lines = changelog.split("\n")
    const sectionPattern = new RegExp(`^## \\[${escapeRegExp(version)}\\]`)

    const startIndex = lines.findIndex(line => sectionPattern.test(line))
    if (startIndex < 0) {
        return `## ${tag}\n\nRelease created from tag ${tag}.\n`
    }

    let endIndex = lines.length
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        if (/^## \[/.test(lines[index])) {
            endIndex = index
            break
        }
    }

    const section = lines.slice(startIndex, endIndex).join("\n").trim()
    if (!section) {
        return `## ${tag}\n\nRelease created from tag ${tag}.\n`
    }

    return `${section}\n`
}

function readPackageVersion(): string {
    const packageJson = JSON.parse(nodeFs.readFileSync("package.json", "utf8")) as PackageJson
    const version = packageJson.version?.trim()
    if (!version) {
        throw new Error("package.json version is missing")
    }
    return version
}

function validateTag(tag: string) {
    const version = readPackageVersion()
    const expectedTag = `v${version}`
    if (tag !== expectedTag) {
        throw new Error(`Tag ${tag} does not match package.json version ${version}`)
    }
}

function generateNotes(tag: string, outputPath: string) {
    const version = readPackageVersion()
    const changelog = nodeFs.readFileSync("CHANGELOG.md", "utf8")
    const notes = resolveReleaseNotes(changelog, version, tag)
    nodeFs.writeFileSync(outputPath, notes)
}

const [, , command, arg1, arg2] = process.argv

if (!command) {
    throw new Error("Missing required command: validate-tag | notes")
}

if (command === "validate-tag") {
    const tag = arg1
    if (!tag) {
        throw new Error("Missing required argument: tag")
    }
    validateTag(tag)
} else if (command === "notes") {
    const tag = arg1
    const outputPath = arg2 ?? "release-notes.md"

    if (!tag) {
        throw new Error("Missing required argument: tag")
    }

    generateNotes(tag, outputPath)
} else {
    throw new Error(`Unknown command: ${command}`)
}
