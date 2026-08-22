#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_BASE_URL = 'https://raw.githubusercontent.com/Jatiiiiiiiin/aidoc/main';

const filesToDownload = [
  { dest: '.github/workflows/ai-docs.yml', src: '.github/workflows/ai-docs.yml' },
  { dest: 'scripts/detectChanges.ts', src: 'scripts/detectChanges.ts' },
  { dest: 'scripts/prepareWebhookPayload.ts', src: 'scripts/prepareWebhookPayload.ts' },
  { dest: 'scripts/routeDocs.ts', src: 'scripts/routeDocs.ts' },
  { dest: 'scripts/validateWebhookResponse.ts', src: 'scripts/validateWebhookResponse.ts' },
  { dest: 'scripts/findExistingDocs.ts', src: 'scripts/findExistingDocs.ts' },
  { dest: 'scripts/updateSections.ts', src: 'scripts/updateSections.ts' },
  { dest: 'scripts/initializeDocs.ts', src: 'scripts/initializeDocs.ts' },
  { dest: 'docs-config/routing.yaml', src: 'docs-config/routing.yaml' }
];

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else if (response.statusCode === 404) {
        reject(new Error(`File not found: ${url}. Make sure your aidoc repo is public or you have the correct URL.`));
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function setup() {
  console.log('🚀 Connecting repository to AI Documentation Automation...\n');

  for (const file of filesToDownload) {
    const destPath = path.join(process.cwd(), file.dest);
    const dir = path.dirname(destPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const url = `${REPO_BASE_URL}/${file.src}`;
    console.log(`Downloading ${file.dest}...`);

    try {
      await downloadFile(url, destPath);
      console.log(`✅ ${file.dest}`);
    } catch (error) {
      console.error(`❌ ${file.dest} — ${error.message}`);
    }
  }

  // Check for tsx dependency
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    console.log('\n📦 Checking dependencies...');
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const hasTsx =
        (pkg.devDependencies && pkg.devDependencies.tsx) ||
        (pkg.dependencies && pkg.dependencies.tsx);

      if (!hasTsx) {
        console.log('⚠️  "tsx" is missing. Run: npm install -D tsx');
      } else {
        console.log('✅ "tsx" found.');
      }
    } catch (e) {
      console.log('⚠️  Could not parse package.json.');
    }
  } else {
    console.log('\n⚠️  No package.json found. Make sure Node.js and "tsx" are installed.');
  }

  console.log('\n✅ Setup complete!');
  console.log('Next steps:');
  console.log('  1. Run: npm install -D tsx yaml minimatch  (if not already installed)');
  console.log('  2. In your GitHub Repository Settings > Secrets and variables > Actions, add:');
  console.log('     AIDOC_WEBHOOK_URL = https://jatiiiiiin.app.n8n.cloud/webhook/ai-docs-pr-merge');
  console.log('     AIDOC_WEBHOOK_SECRET = <your secure secret token, if applicable>');
  console.log('  3. Commit the new files:');
  console.log('     git add .github/ scripts/ docs-config/');
  console.log('     git commit -m "setup: connect to AI documentation pipeline"');
  console.log('  4. Push to main:');
  console.log('     git push origin main');
  console.log('\nThe GitHub Actions workflow will trigger automatically and your docs will appear in the viewer.');
}

setup();
