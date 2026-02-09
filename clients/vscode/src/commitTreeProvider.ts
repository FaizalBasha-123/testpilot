import * as vscode from 'vscode';
import { gitHelper } from '../../../adapters/vscode/gitHelper';

export interface CommitItem {
    sha: string;
    shortSha: string;
    message: string;
    date?: string;
}

export class CommitTreeProvider implements vscode.TreeDataProvider<CommitTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommitTreeItem | undefined | null | void> = new vscode.EventEmitter<CommitTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommitTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private commits: CommitItem[] = [];

    constructor() {
        this.refresh();
    }

    refresh(): void {
        this.loadCommits().then(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    private async loadCommits(): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            this.commits = [];
            return;
        }

        try {
            const commits = await gitHelper.getRecentCommits(workspacePath, 10);
            this.commits = commits;
        } catch (e) {
            console.error('[CommitTreeProvider] Failed to load commits:', e);
            this.commits = [];
        }
    }

    getTreeItem(element: CommitTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommitTreeItem): Thenable<CommitTreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        if (this.commits.length === 0) {
            return Promise.resolve([
                new CommitTreeItem(
                    { sha: '', shortSha: '', message: 'No commits found' },
                    vscode.TreeItemCollapsibleState.None,
                    true
                )
            ]);
        }

        return Promise.resolve(
            this.commits.map(commit => new CommitTreeItem(commit, vscode.TreeItemCollapsibleState.None))
        );
    }
}

export class CommitTreeItem extends vscode.TreeItem {
    constructor(
        public readonly commit: CommitItem,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isPlaceholder: boolean = false
    ) {
        super(
            isPlaceholder ? commit.message : `${commit.shortSha} - ${commit.message.substring(0, 50)}`,
            collapsibleState
        );

        if (!isPlaceholder) {
            this.tooltip = `${commit.sha}\n${commit.message}`;
            this.description = commit.date || '';
            this.iconPath = new vscode.ThemeIcon('git-commit');
            this.contextValue = 'commit';

            // Command to review this commit
            this.command = {
                command: 'testpilot.reviewCommit',
                title: 'Review Commit',
                arguments: [commit]
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
