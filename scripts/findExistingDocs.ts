import * as fs from "fs";
import * as path from "path";

// Parse arguments
const args = process.argv.slice(2);
let inputFile = "";
let outputFile = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && i + 1 < args.length) {
    inputFile = args[i + 1];
    i++;
  } else if (args[i] === "--output" && i + 1 < args.length) {
    outputFile = args[i + 1];
    i++;
  }
}

interface MappingPayload {
  [sourceFile: string]: string; // sourceFile -> docPath
}

function main() {
  let mappings: MappingPayload = {};

  // Read mappings input
  if (inputFile && fs.existsSync(inputFile)) {
    mappings = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
  } else {
    try {
      const stdinBuffer = fs.readFileSync(0);
      if (stdinBuffer.length > 0) {
        mappings = JSON.parse(stdinBuffer.toString("utf-8"));
      }
    } catch (e) {
      // Keep empty
    }
  }

  const toCreate: Record<string, string> = {};
  const toUpdate: Record<string, string> = {};

  for (const [sourceFile, docPath] of Object.entries(mappings)) {
    // Resolve absolute or relative path
    const resolvedPath = path.resolve(docPath);
    
    if (fs.existsSync(resolvedPath)) {
      toUpdate[sourceFile] = docPath;
    } else {
      toCreate[sourceFile] = docPath;
    }
  }

  const result = {
    toCreate,
    toUpdate
  };

  console.log("Categorized documentation tasks:");
  console.log(JSON.stringify(result, null, 2));

  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf-8");
    console.log(`Saved categorized tasks to ${outputFile}`);
  }
}

main();
