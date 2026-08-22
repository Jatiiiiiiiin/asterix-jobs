import * as fs from "fs";
import * as path from "path";

// Parse arguments
const args = process.argv.slice(2);
let inputFile = "";
let outputFile = "";
let configPath = "docs-config/routing.yaml";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && i + 1 < args.length) {
    inputFile = args[i + 1];
    i++;
  } else if (args[i] === "--output" && i + 1 < args.length) {
    outputFile = args[i + 1];
    i++;
  } else if (args[i] === "--config" && i + 1 < args.length) {
    configPath = args[i + 1];
    i++;
  }
}

export interface RouteRule {
  pattern: string;
  dest: string;
}

// Simple parser for docs-config/routing.yaml without requiring npm yaml packages
export function parseRoutingConfig(filePath: string): RouteRule[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`Config file ${filePath} not found. Using default rules.`);
    return [
      { pattern: "src/components/**/*.tsx", dest: "content/docs/components/{name}.mdx" },
      { pattern: "src/hooks/**/*.ts", dest: "content/docs/hooks/{name}.mdx" }
    ];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const rules: RouteRule[] = [];
  let currentPattern = "";
  let currentDest = "";

  const lines = content.split("\n");
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith("#") || !line) continue;

    if (line.startsWith("- pattern:")) {
      const match = line.match(/- pattern:\s*["']?([^"']+)["']?/);
      if (match) currentPattern = match[1];
    } else if (line.startsWith("dest:")) {
      const match = line.match(/dest:\s*["']?([^"']+)["']?/);
      if (match) {
        currentDest = match[1];
        if (currentPattern && currentDest) {
          rules.push({ pattern: currentPattern, dest: currentDest });
          currentPattern = "";
          currentDest = "";
        }
      }
    }
  }
  return rules;
}

// Convert glob to regex
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex specials except * and ?
    .replace(/\*\*\/\*/g, "(.+)") // **/* capture group
    .replace(/\*\*/g, "(.+)") // ** capture group
    .replace(/\*/g, "([^/]+)"); // * capture single path segment
  return new RegExp(`^${escaped}$`);
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function resolveDest(sourceFile: string, rule: RouteRule): string {
  const ext = path.extname(sourceFile);
  const name = path.basename(sourceFile, ext);
  const nameSlug = slugify(name);
  
  // Normalize windows backslashes
  const normalizedSource = sourceFile.replace(/\\/g, "/");
  const dirName = path.dirname(normalizedSource);

  let dest = rule.dest;
  dest = dest.replace("{name}", name);
  dest = dest.replace("{name_slug}", nameSlug);
  dest = dest.replace("{path}", dirName);
  
  return dest;
}

function main() {
  let changedFiles: string[] = [];

  // Read input files from file or stdin
  if (inputFile && fs.existsSync(inputFile)) {
    changedFiles = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  } else {
    // If no input file, check stdin or default to empty
    try {
      if (!process.stdin.isTTY) {
        const stdinBuffer = fs.readFileSync(0);
        if (stdinBuffer.length > 0) {
          changedFiles = JSON.parse(stdinBuffer.toString("utf-8"));
        }
      }
    } catch (e) {
      // No stdin, keep empty
    }
  }

  if (changedFiles.length === 0) {
    console.log("No changed files provided to route.");
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify({}, null, 2));
    }
    return;
  }

  const rules = parseRoutingConfig(configPath);
  console.log(`Parsed ${rules.length} routing rules from ${configPath}`);

  const mappings: Record<string, string> = {};

  for (const file of changedFiles) {
    const normalizedFile = file.replace(/\\/g, "/");
    let matched = false;

    for (const rule of rules) {
      const regex = globToRegex(rule.pattern);
      if (regex.test(normalizedFile)) {
        const dest = resolveDest(file, rule);
        mappings[file] = dest;
        matched = true;
        break;
      }
    }

    if (!matched) {
      console.log(`No routing rule matched for: ${file}`);
    }
  }

  console.log("Mapped documentation files:");
  console.log(JSON.stringify(mappings, null, 2));

  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputFile, JSON.stringify(mappings, null, 2), "utf-8");
    console.log(`Saved mappings to ${outputFile}`);
  }
}

main();
