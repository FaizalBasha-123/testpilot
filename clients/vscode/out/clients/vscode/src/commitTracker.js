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
exports.CommitTracker = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const gitHelper_1 = require("../../../adapters/vscode/gitHelper");
/**
 * Tracks commits made after extension activation.
 * Stores state in workspace storage to persist across sessions.
 */
class CommitTracker {
    constructor(context) {
        this._onCommitsChanged = new vscode.EventEmitter();
        this.onCommitsChanged = this._onCommitsChanged.event;
        this.trackedCommits = [];
        this.activationSha = '';
        this.watcher = null;
        this.workspacePath = '';
        this.context = context;
    }
    initialize(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            this.workspacePath = workspacePath;
            // Get the current HEAD as our "activation point"
            const currentCommits = yield gitHelper_1.gitHelper.getRecentCommits(workspacePath, 1);
            if (currentCommits.length > 0) {
                this.activationSha = currentCommits[0].sha;
            }
            // Load previously tracked commits from workspace state
            const stored = this.context.workspaceState.get('trackedCommits', []);
            this.trackedCommits = stored;
            // Start watching for new commits
            this.startWatching();
            // Initial refresh
            yield this.refreshCommits();
        });
    }
    startWatching() {
        const gitLogsPath = path.join(this.workspacePath, '.git', 'logs', 'HEAD');
        if (fs.existsSync(gitLogsPath)) {
            try {
                this.watcher = fs.watch(gitLogsPath, { persistent: false }, () => __awaiter(this, void 0, void 0, function* () {
                    yield this.refreshCommits();
                }));
            }
            catch (e) {
                console.error('[CommitTracker] Failed to watch git logs:', e);
            }
        }
    }
    refreshCommits() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.workspacePath)
                return;
            try {
                // Get recent commits (last 20)
                const commits = yield gitHelper_1.gitHelper.getRecentCommits(this.workspacePath, 20);
                // Find new commits (those we haven't tracked yet)
                for (const commit of commits) {
                    const existing = this.trackedCommits.find(c => c.sha === commit.sha);
                    if (!existing) {
                        // Get files changed in this commit
                        const files = yield gitHelper_1.gitHelper.getCommitFiles(this.workspacePath, commit.sha);
                        this.trackedCommits.unshift({
                            sha: commit.sha,
                            shortSha: commit.shortSha,
                            message: commit.message,
                            date: commit.date || new Date().toISOString().split('T')[0],
                            files: files,
                            status: 'pending'
                        });
                    }
                }
                // Keep only last 50 commits
                this.trackedCommits = this.trackedCommits.slice(0, 50);
                // Save to workspace state
                yield this.context.workspaceState.update('trackedCommits', this.trackedCommits);
                this._onCommitsChanged.fire();
            }
            catch (e) {
                console.error('[CommitTracker] Refresh failed:', e);
            }
        });
    }
    getTrackedCommits() {
        return this.trackedCommits;
    }
    getCommit(sha) {
        return this.trackedCommits.find(c => c.sha === sha);
    }
    updateCommitStatus(sha, status, reviewData) {
        return __awaiter(this, void 0, void 0, function* () {
            const commit = this.trackedCommits.find(c => c.sha === sha);
            if (commit) {
                commit.status = status;
                if (reviewData) {
                    commit.reviewData = reviewData;
                }
                yield this.context.workspaceState.update('trackedCommits', this.trackedCommits);
                this._onCommitsChanged.fire();
            }
        });
    }
    getReviewedCommits() {
        return this.trackedCommits.filter(c => c.status === 'reviewed');
    }
    dispose() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
exports.CommitTracker = CommitTracker;
//# sourceMappingURL=commitTracker.js.map