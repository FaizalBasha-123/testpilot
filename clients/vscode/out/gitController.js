"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitController = void 0;
const cp = require("child_process");
const path = require("path");
const fs = require("fs");
/**
 * GitController - Secure Git Operations for Phoenix Agent
 *
 * Manages repository state programmatically using secure child_process.execFile.
 * Handles initialization, snapshotting (commits), and diff extraction.
 */
class GitController {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    /**
     * Execute a git command securely within the workspace root
     */
    execGit(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // execFile is safer than exec as it avoids shell injection
                cp.execFile('git', args, { cwd: this.workspaceRoot, encoding: 'utf8' }, (err, stdout, stderr) => {
                    if (err) {
                        // Git returns non-zero exit code for some valid operations (like empty diffs)
                        // But generally, we treat stderr as error content if exit code is non-zero
                        reject(stderr || err.message);
                    }
                    else {
                        resolve(stdout.trim());
                    }
                });
            });
        });
    }
    /**
     * Check if .git directory exists
     */
    isGitInitialized() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const gitDir = path.join(this.workspaceRoot, '.git');
                yield fs.promises.access(gitDir);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    /**
     * Initialize repository if needed
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isGitInitialized())
                return;
            console.log('[Phoenix] Initializing Git repository...');
            yield this.execGit(['init']);
            // Initial commit to establish HEAD
            yield this.execGit(['add', '-A']);
            yield this.execGit(['commit', '-m', 'Phoenix Agent: Initializing workspace']);
        });
    }
    /**
     * Create a pre-review snapshot (Stage A)
     * Commits all current changes so we can diff against HEAD~1 (or just HEAD if we want working tree diff)
     *
     * Strategy:
     * 1. Add all changes.
     * 2. Commit with a specific message.
     */
    createSnapshot(message = 'Phoenix Agent: Pre-review snapshot') {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if there are changes first
                const status = yield this.execGit(['status', '--porcelain']);
                if (!status) {
                    console.log('[Phoenix] No changes to snapshot.');
                    return;
                }
                yield this.execGit(['add', '-A']);
                yield this.execGit(['commit', '-m', message]);
                console.log(`[Phoenix] Snapshot created: ${message}`);
            }
            catch (error) {
                console.error('[Phoenix] Snapshot failed:', error);
                throw new Error(`Failed to create snapshot: ${error}`);
            }
        });
    }
    /**
     * Extract the unified diff for the last commit (HEAD)
     * Used to send context to the AI (Stage A).
     */
    getHeadDiff() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Diff the last commit against its parent
                // If it's the very first commit, HEAD~1 might fail.
                // Fallback: git show HEAD
                try {
                    return yield this.execGit(['diff', 'HEAD~1', 'HEAD', '--unified=3']);
                }
                catch (_a) {
                    // Likely initial commit
                    return yield this.execGit(['show', 'HEAD', '--format=', '--unified=3']);
                }
            }
            catch (error) {
                console.error('[Phoenix] Failed to get diff:', error);
                throw error;
            }
        });
    }
    /**
     * Extract diff of Working Tree vs HEAD (Uncommitted changes)
     * Useful if we want to review *without* committing first (optional flow)
     */
    getWorkingTreeDiff() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.execGit(['diff', 'HEAD', '--unified=3']);
        });
    }
}
exports.GitController = GitController;
//# sourceMappingURL=gitController.js.map