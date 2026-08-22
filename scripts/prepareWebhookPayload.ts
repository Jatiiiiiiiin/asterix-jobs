import * as fs from "fs";
import * as path from "path";

// Parse arguments
const args = process.argv.slice(2);
let changedFilesPath = "changed-files.json";
let outputPath = "n8n-payload.json";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && i + 1 < args.length) {
    changedFilesPath = args[i + 1];
    i++;
  } else if (args[i] === "--output" && i + 1 < args.length) {
    outputPath = args[i + 1];
    i++;
  }
}

function main() {
  if (!fs.existsSync(changedFilesPath)) {
    console.error(`Input file not found: ${changedFilesPath}`);
    process.exit(1);
  }

  const changedFiles = JSON.parse(fs.readFileSync(changedFilesPath, "utf-8"));

  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    console.log("No changed source files detected. Skipping payload generation.");
    process.exit(0);
  }

  // Fetch GitHub environment variables
  const repo = process.env.GITHUB_REPOSITORY || "owner/repo";
  const branch = process.env.GITHUB_REF_NAME || "main";
  
  // Use GITHUB_EVENT_PATH to parse details for a merged PR
  let commitSha = process.env.GITHUB_SHA || "";
  let prNumber: number | null = null;

  if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    try {
      const eventData = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf-8"));
      if (eventData.pull_request) {
        prNumber = eventData.pull_request.number;
        // Use the merge commit sha if available
        if (eventData.pull_request.merge_commit_sha) {
          commitSha = eventData.pull_request.merge_commit_sha;
        }
      }
    } catch (e) {
      console.warn("Failed to parse GITHUB_EVENT_PATH, falling back to env globals.", e);
    }
  }

  const payload = {
    ref: `refs/heads/${branch}`,
    before: "0000000000000000000000000000000000000000",
    after: commitSha,
    repository: {
      full_name: repo,
      default_branch: branch,
    },
    commits: [
      {
        id: commitSha,
        message: "Filtered AI Docs update",
        added: changedFiles, // Treating all changes as 'added' ensures they are processed
        removed: [],
        modified: []
      }
    ],
    head_commit: {
      id: commitSha,
      added: changedFiles,
      removed: [],
      modified: []
    }
  };

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Generated n8n webhook payload at: ${outputPath}`);
  console.log(JSON.stringify(payload, null, 2));
}

main();
