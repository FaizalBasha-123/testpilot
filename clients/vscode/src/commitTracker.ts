import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { gitHelper } from '../../../adapters/vscode/gitHelper';

export interface TrackedCommit {
    sha: string;
    shortSha: string;
    message: string;
    date: string;
    files: string[];
    status: 'pending' | 'analyzing' | 'reviewed';
    reviewData?: any;
}

/**
 * Tracks commits made after extension activation.
 * Stores state in workspace storage to persist across sessions.
 */
export class CommitTracker {
    private _onCommitsChanged = new vscode.EventEmitter<void>();
    readonly onCommitsChanged = this._onCommitsChanged.event;

    private trackedCommits: TrackedCommit[] = [];
    private activationSha: string = '';
    private watcher: fs.FSWatcher | null = null;
    private workspacePath: string = '';
    private context: vscode.ExtensionContext;
    private installedAt: string = '';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async initialize(workspacePath: string): Promise<void> {
        this.workspacePath = workspacePath;

        const storedInstallTs = this.context.workspaceState.get<string>('testpilotInstalledAt');
        if (storedInstallTs) {
            this.installedAt = storedInstallTs;
        } else {
            this.installedAt = new Date().toISOString();
            await this.context.workspaceState.update('testpilotInstalledAt', this.installedAt);
        }

        // Get the current HEAD as our "activation point"
        const currentCommits = await gitHelper.getRecentCommits(workspacePath, 1);
        if (currentCommits.length > 0) {
            this.activationSha = currentCommits[0].sha;
        }

        // Load previously tracked commits from workspace state
        const stored = this.context.workspaceState.get<TrackedCommit[]>('trackedCommits', []);
        this.trackedCommits = stored;

        // Start watching for new commits
        this.startWatching();

        // Initial refresh
        await this.refreshCommits();
    }

    private startWatching(): void {
        const gitLogsPath = path.join(this.workspacePath, '.git', 'logs', 'HEAD');

        if (fs.existsSync(gitLogsPath)) {
            try {
                this.watcher = fs.watch(gitLogsPath, { persistent: false }, async () => {
                    await this.refreshCommits();
                });
            } catch (e) {
                console.error('[CommitTracker] Failed to watch git logs:', e);
            }
        }
    }

    async refreshCommits(): Promise<void> {
        if (!this.workspacePath) return;

        try {
            // Get recent commits (last 20)
            const commits = await gitHelper.getRecentCommits(this.workspacePath, 20);

            // Find new commits (those we haven't tracked yet) made after extension install time.
            const installedAtMs = Date.parse(this.installedAt);
            for (const commit of commits) {
                const commitDateMs = Date.parse(commit.date || '');
                if (!Number.isNaN(installedAtMs) && !Number.isNaN(commitDateMs) && commitDateMs < installedAtMs) {
                    continue;
                }

                const existing = this.trackedCommits.find(c => c.sha === commit.sha);
                if (!existing) {
                    // Get files changed in this commit
                    const files = await gitHelper.getCommitFiles(this.workspacePath, commit.sha);

                    this.trackedCommits.unshift({
                        sha: commit.sha,
                        shortSha: commit.shortSha,
                        message: commit.message,
                        date: (commit.date || new Date().toISOString()).split('T')[0],
                        files: files,
                        status: 'pending'
                    });
                }
            }

            this.trackedCommits.sort((a, b) => b.date.localeCompare(a.date));

            // Keep only last 50 commits
            this.trackedCommits = this.trackedCommits.slice(0, 50);

            // Save to workspace state
            await this.context.workspaceState.update('trackedCommits', this.trackedCommits);

            this._onCommitsChanged.fire();
        } catch (e) {
            console.error('[CommitTracker] Refresh failed:', e);
        }
    }

    getTrackedCommits(): TrackedCommit[] {
        return [...this.trackedCommits].sort((a, b) => b.date.localeCompare(a.date));
    }

    getCommit(sha: string): TrackedCommit | undefined {
        return this.trackedCommits.find(c => c.sha === sha);
    }

    async updateCommitStatus(sha: string, status: TrackedCommit['status'], reviewData?: any): Promise<void> {
        const commit = this.trackedCommits.find(c => c.sha === sha);
        if (commit) {
            commit.status = status;
            if (reviewData) {
                commit.reviewData = reviewData;
            }
            await this.context.workspaceState.update('trackedCommits', this.trackedCommits);
            this._onCommitsChanged.fire();
        }
    }

    getReviewedCommits(): TrackedCommit[] {
        return this.trackedCommits.filter(c => c.status === 'reviewed');
    }

    dispose(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}
