// Extension: bump-version
// Reads version from ./server.json and replaces all occurrences in the repo.
// Supports: bump patch (default), bump minor (resets patch), bump major (resets minor+patch).

import { joinSession } from "@github/copilot-sdk/extension";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Derive repo root from this extension's location: .github/extensions/bump-version/extension.mjs
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), "..", "..", "..");

function readCurrentVersion(cwd) {
    const serverJson = JSON.parse(readFileSync(join(cwd, "server.json"), "utf8"));
    return serverJson.version;
}

function bumpVersion(current, type) {
    const [major, minor, patch] = current.split(".").map(Number);
    switch (type) {
        case "major":
            return `${major + 1}.0.0`;
        case "minor":
            return `${major}.${minor + 1}.0`;
        case "patch":
        default:
            return `${major}.${minor}.${patch + 1}`;
    }
}

function walkFiles(dir, skipDirs = ["node_modules", ".git", "dist", "build"]) {
    const results = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!skipDirs.includes(entry.name)) {
                results.push(...walkFiles(fullPath, skipDirs));
            }
        } else {
            results.push(fullPath);
        }
    }
    return results;
}

function replaceInRepo(cwd, oldVersion, newVersion) {
    const files = walkFiles(cwd);
    const changed = [];
    for (const file of files) {
        try {
            const content = readFileSync(file, "utf8");
            if (content.includes(oldVersion)) {
                const updated = content.replaceAll(oldVersion, newVersion);
                writeFileSync(file, updated, "utf8");
                changed.push(relative(cwd, file));
            }
        } catch {
            // skip binary files or permission errors
        }
    }
    return changed;
}

const session = await joinSession({
    tools: [
        {
            name: "bump_version",
            description:
                "Bump the project version (reads from server.json, replaces all occurrences in repo). " +
                "Use 'patch' (default) to increment patch, 'minor' to increment minor and reset patch, " +
                "'major' to increment major and reset minor+patch.",
            parameters: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: ["patch", "minor", "major"],
                        description: "Which semver component to bump. Defaults to 'patch'.",
                    },
                },
            },
            skipPermission: true,
            handler: async (args, invocation) => {
                const cwd = REPO_ROOT;
                const bumpType = args.type || "patch";

                try {
                    const oldVersion = readCurrentVersion(cwd);
                    const newVersion = bumpVersion(oldVersion, bumpType);
                    const changedFiles = replaceInRepo(cwd, oldVersion, newVersion);

                    return [
                        `✅ Version bumped: ${oldVersion} → ${newVersion} (${bumpType})`,
                        `Files updated (${changedFiles.length}):`,
                        ...changedFiles.map((f) => `  - ${f}`),
                    ].join("\n");
                } catch (err) {
                    return { textResultForLlm: `❌ Failed: ${err.message}`, resultType: "failure" };
                }
            },
        },
    ],
});
