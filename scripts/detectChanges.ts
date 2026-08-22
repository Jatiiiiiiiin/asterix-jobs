import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Parse arguments
const args = process.argv.slice(2);
let baseCommit = "";
let headCommit = "";
let outputFile = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base" && i + 1 < args.length) {
    baseCommit = args[i + 1];
    i++;
  } else if (args[i] === "--head" && i + 1 < args.length) {
    headCommit = args[i + 1];
    i++;
  } else if (args[i] === "--output" && i + 1 < args.length) {
    outputFile = args[i + 1];
    i++;
  }
}

// Allowed source file extensions
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

// High-priority directories — these files are sorted to the front of the output
// so n8n processes the most architecturally significant files first
const HIGH_PRIORITY_PATTERNS = [
  /^src\/app\/api\//,
  /^src\/services\//,
  /^src\/lib\//,
  /^scripts\//,
];

// Directories to ignore
const IGNORED_DIR_PATTERNS = [
  /^node_modules\//,
  /^\.github\//,
  /^\.next\//,
  /^dist\//,
  /^docs-config\//,
  /^public\//,
  /^\.git\//
];

// Specific config files to ignore
const IGNORED_FILES = new Set([
  "next.config.ts",
  "next.config.js",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "tsconfig.json",
  "package.json",
  "package-lock.json"
]);

function getChangedFiles(base: string, head: string): string[] {
  try {
    let command = "git diff --name-only";
    if (base && head) {
      command = `git diff --name-only ${base} ${head}`;
    } else if (base) {
      command = `git diff --name-only ${base}`;
    } else {
      // Default to last commit
      command = "git diff --name-only HEAD~1 HEAD";
    }

    console.log(`Running git command: ${command}`);
    const output = execSync(command, { encoding: "utf-8" });
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch (error) {
    console.error("Error executing git diff:", error);
    // If not a git repo or no commits, return empty
    return [];
  }
}

function filterSourceFiles(files: string[]): string[] {
  return files.filter((file) => {
    const ext = path.extname(file);
    const basename = path.basename(file);

    // 1. Check extension
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return false;
    }

    // 2. Check ignored config files
    if (IGNORED_FILES.has(basename)) {
      return false;
    }

    // 3. Check ignored directory paths
    const normalizedPath = file.replace(/\\/g, "/");
    for (const pattern of IGNORED_DIR_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return false;
      }
    }

    return true;
  });
}

function prioritizeFiles(files: string[]): string[] {
  const normalized = files.map((f) => f.replace(/\\/g, "/"));
  const high = normalized.filter((f) => HIGH_PRIORITY_PATTERNS.some((p) => p.test(f)));
  const rest = normalized.filter((f) => !HIGH_PRIORITY_PATTERNS.some((p) => p.test(f)));
  return [...high, ...rest];
}

function main() {
  const allChanged = getChangedFiles(baseCommit, headCommit);
  const filtered = prioritizeFiles(filterSourceFiles(allChanged));

  console.log(`Detected ${allChanged.length} total changed files.`);
  console.log(`Filtered down to ${filtered.length} source code files:`);
  console.log(JSON.stringify(filtered, null, 2));

  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputFile, JSON.stringify(filtered, null, 2), "utf-8");
    console.log(`Saved filtered files to ${outputFile}`);
  }
}

main();
