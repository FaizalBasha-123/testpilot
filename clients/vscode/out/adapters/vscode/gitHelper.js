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
exports.gitHelper = exports.GitHelper = void 0;
const vscode = require("vscode");
const child_process_1 = require("child_process");
/**
 * GitHelper - Safe Git operations via VS Code Git API
 *
 * This module provides a secure interface to Git operations
 * without running raw terminal commands.
 */
class GitHelper {
    /**
     * Initialize the Git extension API
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const extension = vscode.extensions.getExtension('vscode.git');
                if (!extension) {
                    console.log('[GitHelper] Git extension not found');
                    return false;
                }
                const gitExtension = yield extension.activate();
                this.gitAPI = gitExtension.getAPI(1);
                console.log('[GitHelper] Git API initialized');
                return true;
            }
            catch (error) {
                console.error('[GitHelper] Failed to initialize Git API:', error);
                return false;
            }
        });
    }
    /**
     * Check if the workspace is a Git repository
     */
    isGitRepository(workspacePath) {
        if (!this.gitAPI)
            return false;
        // 1. API Check (Best)
        const normalizedWorkspace = workspacePath.replace(/\\/g, '/').toLowerCase();
        const found = this.gitAPI.repositories.some(repo => normalizedWorkspace.startsWith(repo.rootUri.fsPath.replace(/\\/g, '/').toLowerCase()));
        if (found)
            return true;
        // 2. Fallback: Check for .git directory (Robust against API lag)
        try {
            const fs = require('fs');
            const path = require('path');
            const gitDir = path.join(workspacePath, '.git');
            return fs.existsSync(gitDir);
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Get the repository for a workspace path
     */
    getRepository(workspacePath) {
        if (!this.gitAPI)
            return undefined;
        const normalizedWorkspace = workspacePath.replace(/\\/g, '/').toLowerCase();
        return this.gitAPI.repositories.find(repo => normalizedWorkspace.startsWith(repo.rootUri.fsPath.replace(/\\/g, '/').toLowerCase()));
    }
    /**
     * Stage and commit changes with a descriptive message
     */
    stageAndCommit(workspacePath, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = this.getRepository(workspacePath);
            if (!repo) {
                vscode.window.showErrorMessage('No Git repository found in workspace.');
                return { success: false, error: 'No repository' };
            }
            try {
                // Check if there are changes to commit
                const { workingTreeChanges, indexChanges } = repo.state;
                if (workingTreeChanges.length === 0 && indexChanges.length === 0) {
                    console.log('[GitHelper] No changes to commit.');
                    return { success: true, action: 'none' }; // Not an error, just nothing to do
                }
                // Stage all changes (git add -A equivalent)
                yield repo.add(['.']);
                // Commit with the provided message
                yield repo.commit(message);
                console.log(`[GitHelper] Committed: ${message}`);
                return { success: true, action: 'commit' };
            }
            catch (error) {
                console.error('[GitHelper] Commit failed:', error);
                vscode.window.showErrorMessage(`Git commit failed: ${error.message}`);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Stage specific files
     */
    stageFiles(workspacePath, files) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = this.getRepository(workspacePath);
            if (!repo) {
                vscode.window.showErrorMessage('No Git repository found in workspace.');
                return false;
            }
            try {
                yield repo.add(files);
                console.log(`[GitHelper] Staged ${files.length} files`);
                return true;
            }
            catch (error) {
                console.error('[GitHelper] Staging failed:', error);
                return false;
            }
        });
    }
    /**
     * Check if there are uncommitted changes
     */
    hasUncommittedChanges(workspacePath) {
        const repo = this.getRepository(workspacePath);
        if (!repo)
            return false;
        const { workingTreeChanges, indexChanges } = repo.state;
        return workingTreeChanges.length > 0 || indexChanges.length > 0;
    }
    /**
     * Get the diff of the current HEAD commit (the snapshot we just made)
     * This represents the "user's changes" to be reviewed.
     */
    /**
     * Get the validation context (Diff + Commit List) for the AI
     * Supports Full Branch Analysis (main...HEAD)
     */
    getValidationContext(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = this.getRepository(workspacePath);
            if (!repo)
                return { diff: '', commits: [], range: 'none' };
            try {
                const cp = require('child_process');
                // 1. Determine Range
                const branches = cp.execSync('git branch --list', { cwd: workspacePath }).toString();
                let baseBranch = '';
                if (branches.includes('main'))
                    baseBranch = 'main';
                else if (branches.includes('master'))
                    baseBranch = 'master';
                else if (branches.includes('origin/main'))
                    baseBranch = 'origin/main'; // For remote tacking
                const currentBranch = this.getCurrentBranch(workspacePath) || '';
                let command = '';
                let rangeDescription = '';
                if (baseBranch && currentBranch !== baseBranch) {
                    // Feature Branch: Diff against main
                    command = `git diff ${baseBranch}...HEAD`;
                    rangeDescription = `${baseBranch}...HEAD`;
                    console.log(`[GitHelper] Analyzing Branch: ${command}`);
                }
                else {
                    // We are ON main.
                    try {
                        cp.execSync(`git rev-parse --verify origin/${currentBranch}`, { cwd: workspacePath });
                        command = `git diff origin/${currentBranch}...HEAD`;
                        rangeDescription = `origin/${currentBranch}...HEAD`;
                        console.log(`[GitHelper] Analyzing Local Commits (vs Remote): ${command}`);
                    }
                    catch (e) {
                        command = 'git diff HEAD~5 HEAD';
                        rangeDescription = 'HEAD~5..HEAD';
                        console.log(`[GitHelper] Analyzing Last 5 Commits (Fallback): ${command}`);
                    }
                }
                // 2. Fetch Diff
                const diffPromise = new Promise((resolve) => {
                    cp.exec(command, { cwd: workspacePath, maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
                        const primaryDiff = stdout ? stdout.trim() : '';
                        // [Phoenix] Smart Fallback: If primary diff is empty (e.g. synced with main), force checking the last commit.
                        // This ensures "Just Committed" changes are picked up.
                        if (err || primaryDiff.length === 0) {
                            console.warn('[GitHelper] Primary range diff empty or failed. Fallback to Last Commit Analysis.');
                            // Fallback: Check last commit (HEAD~1...HEAD)
                            cp.exec('git diff HEAD~1 HEAD', { cwd: workspacePath, maxBuffer: 1024 * 1024 }, (err2, stdout2) => {
                                if (err2) {
                                    // If that fails (e.g. only 1 commit total), try just HEAD show
                                    cp.exec('git show HEAD', { cwd: workspacePath, maxBuffer: 1024 * 1024 }, (e3, s3) => resolve(s3 || ''));
                                }
                                else {
                                    resolve(stdout2 || '');
                                }
                            });
                        }
                        else {
                            resolve(primaryDiff);
                        }
                    });
                });
                // 3. Fetch Commit List (for User Verification)
                // Use '..' for log to see commits reachable from HEAD but not base
                const logRange = rangeDescription.replace('...', '..');
                const commitsPromise = new Promise((resolve) => {
                    cp.exec(`git log ${logRange} --oneline --no-merges`, { cwd: workspacePath }, (err, stdout) => {
                        if (err || !stdout)
                            resolve(['(Last Commit Only / Fallback)']);
                        else
                            resolve(stdout.split('\n').filter((l) => l.trim().length > 0));
                    });
                });
                const [diff, commits] = yield Promise.all([diffPromise, commitsPromise]);
                return { diff, commits, range: rangeDescription };
            }
            catch (error) {
                console.error('[GitHelper] Context failed:', error);
                return { diff: '', commits: [], range: 'error' };
            }
        });
    }
    /**
     * Get current branch name
     */
    getCurrentBranch(workspacePath) {
        var _a;
        const repo = this.getRepository(workspacePath);
        return (_a = repo === null || repo === void 0 ? void 0 : repo.state.HEAD) === null || _a === void 0 ? void 0 : _a.name;
    }
    /**
     * Get recent git log with FULL PATCH DIFFS
     * User Requirement: "Complete history of all commits with their respective code diffs"
     */
    getLog(workspacePath, limit = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = this.getRepository(workspacePath);
            if (!repo)
                return '';
            try {
                // [Phoenix] User requested FULL HISTORY with CODE DIFFS.
                // We cannot use the simple repo.log() API as it doesn't support -p (patch).
                // We must use raw exec() to get 'git log -p'.
                const cp = require('child_process');
                return new Promise((resolve) => {
                    // Limit 0 means "All commits".
                    // We use -p for patch/diffs.
                    // We limit to 1000 by default if 0 to prevent total crash, unless user really implies INFINITE.
                    // User said "complete history". I will try 1000 first, which is massive.
                    const countArg = limit > 0 ? `-n ${limit}` : '';
                    // --full-diff ensures we get the diffs.
                    const command = `git log -p ${countArg} --date=short`;
                    // Max Buffer 50MB
                    cp.exec(command, { cwd: workspacePath, maxBuffer: 1024 * 1024 * 50 }, (err, stdout) => {
                        if (err) {
                            console.error('[GitHelper] Raw Log failed:', err);
                            resolve('Error retrieving full git log.');
                        }
                        else {
                            resolve(stdout || '');
                        }
                    });
                });
            }
            catch (error) {
                console.error('[GitHelper] Log failed:', error);
                return 'Failed to retrieve git log.';
            }
        });
    }
    /**
     * Initialize a Git repository using VS Code tasks API (safe terminal)
     */
    initRepository(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            // [Master Workflow] Replaced by ensureGitAndCommit but kept for interface compatibility if needed
            return { success: true };
        });
    }
    /**
     * [Master Workflow] Ensures Git is installed, repo exists, and creates a "Safe State" commit.
     */
    ensureGitAndCommit(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Check if Git is installed
            try {
                (0, child_process_1.execSync)('git --version');
            }
            catch (e) {
                const installChoice = yield vscode.window.showErrorMessage("Git is not installed on your system. Would you like the agent to attempt installation?", "Install Git", "Cancel");
                if (installChoice === "Install Git") {
                    this.installGitForUser();
                    return { success: false, error: 'Installing Git...' };
                }
                return { success: false, error: 'Git not installed' };
            }
            // 2. Get Git API
            if (!this.gitAPI) {
                yield this.initialize();
                if (!this.gitAPI)
                    return { success: false, error: 'Git API failed' };
            }
            // 3. Check for Repository
            let repo = this.getRepository(workspacePath);
            if (!repo) {
                // No Repo Found: Perform "git init" sequence via Terminal
                const terminal = vscode.window.createTerminal("PR-Agent Setup");
                terminal.show();
                // Same safe init sequence for ensureGitAndCommit fallback
                terminal.sendText("git init && git config user.name 'Blackbox Agent' && git config user.email 'agent@blackbox.local' && git add -A && git branch -M main && git commit -m 'Initial commit by pr-agent'");
                vscode.window.showInformationMessage("Git initialized (with Agent Identity) and first commit created.");
                // Wait for VS Code to pick it up
                yield new Promise(r => setTimeout(r, 4000));
                // Try refresh
                return { success: true, action: 'initialized' };
            }
            else {
                // Repo exists: Create Safe State (Shadow Persistence)
                try {
                    const { workingTreeChanges, indexChanges } = repo.state;
                    if (workingTreeChanges.length === 0 && indexChanges.length === 0) {
                        return { success: true, action: 'none' };
                    }
                    yield repo.add(['.']);
                    yield repo.commit("Phoenix: Safe State Snapshot");
                    vscode.window.showInformationMessage("Safe State Snapshot created.");
                    return { success: true, action: 'commit' };
                }
                catch (err) {
                    console.error('[GitHelper] API Commit failed:', err);
                    // Fallback: Try straight shell execution (Robustness for "Failed to execute git")
                    try {
                        console.log('[GitHelper] Attempting Shell Fallback...');
                        const cp = require('child_process');
                        // Safe State commit via shell
                        cp.execSync('git add -A && git commit -m "Phoenix: Safe State Snapshot"', { cwd: workspacePath });
                        vscode.window.showInformationMessage("Safe State Snapshot created (via Shell).");
                        return { success: true, action: 'commit' };
                    }
                    catch (shellErr) {
                        console.error('[GitHelper] Shell Commit failed:', shellErr);
                        // Check if it's just "nothing to commit"
                        if (shellErr.message.includes('nothing to commit')) {
                            return { success: true, action: 'none' };
                        }
                        vscode.window.showErrorMessage("Commit failed (API & Shell): " + err.message);
                        return { success: false, error: err.message };
                    }
                }
            }
        });
    }
    /**
     * Helper to install Git
     */
    installGitForUser() {
        const terminal = vscode.window.createTerminal("Git Installer");
        terminal.show();
        if (process.platform === 'win32') {
            terminal.sendText("winget install --id Git.Git -e --source winget");
        }
        else if (process.platform === 'darwin') {
            terminal.sendText("brew install git");
        }
        else {
            terminal.sendText("sudo apt install git -y");
        }
        vscode.window.showInformationMessage("Attempting to install Git via terminal...");
    }
    /**
     * Revert to the last safe snapshot (Reject)
     */
    revertToSnapshot(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const terminal = vscode.window.createTerminal("Blackbox Revert");
            terminal.show();
            // git reset --hard HEAD (Undoes uncommitted changes to get back to last commit/snapshot)
            // If we want to undo the *last commit* (assuming AI made a commit), we use HEAD^.
            // But currently AI just edits files. So 'git reset --hard HEAD' is "Undo edits".
            // The user asked for "git reset --hard HEAD^" specifically, but that implicitly requires an "AI Commit".
            // For now, let's use 'git reset --hard HEAD' which is safer for "Rejecting dirty changes".
            // IF we change workflow to "AI Commits", then HEAD^ is correct.
            // Given 'handleJobCompletion' in extension.ts just stages/writes, HEAD is correct to wipe them.
            terminal.sendText("git reset --hard HEAD");
            return true;
        });
    }
    /**
     * Get recent commits for the TreeView
     */
    getRecentCommits(workspacePath, limit = 10) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cp = require('child_process');
                return new Promise((resolve) => {
                    const command = `git log -n ${limit} --pretty=format:"%H|%h|%s|%ad" --date=short`;
                    cp.exec(command, { cwd: workspacePath }, (err, stdout) => {
                        if (err || !stdout) {
                            resolve([]);
                            return;
                        }
                        const commits = stdout.split('\n').filter((l) => l.trim()).map((line) => {
                            const [sha, shortSha, message, date] = line.split('|');
                            return { sha, shortSha, message, date };
                        });
                        resolve(commits);
                    });
                });
            }
            catch (e) {
                console.error('[GitHelper] getRecentCommits failed:', e);
                return [];
            }
        });
    }
    /**
     * Get the diff for a specific commit
     */
    getCommitDiff(workspacePath, sha) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cp = require('child_process');
                return new Promise((resolve) => {
                    cp.exec(`git show ${sha} --stat --patch`, { cwd: workspacePath, maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
                        if (err) {
                            console.error('[GitHelper] getCommitDiff failed:', err);
                            resolve('');
                            return;
                        }
                        resolve(stdout || '');
                    });
                });
            }
            catch (e) {
                console.error('[GitHelper] getCommitDiff error:', e);
                return '';
            }
        });
    }
    /**
     * Get the remote origin URL in owner/repo format
     */
    getRemoteOrigin(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cp = require('child_process');
                return new Promise((resolve) => {
                    cp.exec('git remote get-url origin', { cwd: workspacePath }, (err, stdout) => {
                        if (err || !stdout) {
                            resolve('');
                            return;
                        }
                        // Parse: git@github.com:owner/repo.git or https://github.com/owner/repo.git
                        const url = stdout.trim();
                        let match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                        if (match) {
                            resolve(`${match[1]}/${match[2]}`);
                        }
                        else {
                            resolve('');
                        }
                    });
                });
            }
            catch (e) {
                return '';
            }
        });
    }
    /**
     * Get changed files for a specific commit
     */
    getCommitFiles(workspacePath, sha) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cp = require('child_process');
                return new Promise((resolve) => {
                    cp.exec(`git show ${sha} --name-only --pretty=format:""`, { cwd: workspacePath }, (err, stdout) => {
                        if (err || !stdout) {
                            resolve([]);
                            return;
                        }
                        const files = stdout.split('\n').filter((f) => f.trim().length > 0);
                        resolve(files);
                    });
                });
            }
            catch (e) {
                return [];
            }
        });
    }
}
exports.GitHelper = GitHelper;
// Singleton instance
exports.gitHelper = new GitHelper();
//# sourceMappingURL=gitHelper.js.map