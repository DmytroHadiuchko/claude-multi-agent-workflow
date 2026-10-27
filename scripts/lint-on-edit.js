// PostToolUse hook: after Claude edits a .js file inside course-api/, run that
// project's own ESLint on the file. Lint errors go to stderr with exit 2, which
// Claude Code feeds back to Claude so it can fix them in the same turn.
// Anything that is not a course-api .js file, or a checkout without
// node_modules, is skipped silently with exit 0.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const API_DIR = 'course-api';

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

// Walk up from the file to the course-api directory that contains it.
function findApiRoot(file) {
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    if (path.basename(dir) === API_DIR) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

const input = readInput();
const filePath = input && input.tool_input && input.tool_input.file_path;
if (!filePath || !filePath.endsWith('.js')) process.exit(0);

const absFile = path.resolve(input.cwd || process.cwd(), filePath);
const apiRoot = findApiRoot(absFile);
if (!apiRoot) process.exit(0);

const relFile = path.relative(apiRoot, absFile);
if (relFile.split(path.sep)[0] === 'node_modules') process.exit(0);

// Use the project's ESLint, never a global or npx download.
const eslintBin = path.join(apiRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
if (!fs.existsSync(eslintBin)) process.exit(0);

const result = spawnSync(process.execPath, [eslintBin, relFile], {
  cwd: apiRoot,
  encoding: 'utf8',
});

if (result.status === 0) process.exit(0);

if (result.status === 1) {
  // ESLint found errors in the edited file.
  process.stderr.write(`ESLint errors in ${relFile} — fix them:\n${result.stdout}`);
  process.exit(2);
}

// ESLint itself failed (bad config, crash): tell the user, but don't push it to Claude.
process.stderr.write(`lint-on-edit: ESLint could not run on ${relFile}:\n${result.stderr || result.error}`);
process.exit(1);
