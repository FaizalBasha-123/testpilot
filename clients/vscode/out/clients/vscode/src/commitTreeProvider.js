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
exports.CommitTreeItem = exports.CommitTreeProvider = void 0;
const vscode = require("vscode");
const gitHelper_1 = require("../../../adapters/vscode/gitHelper");
class CommitTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.commits = [];
        this.refresh();
    }
    refresh() {
        this.loadCommits().then(() => {
            this._onDidChangeTreeData.fire();
        });
    }
    loadCommits() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!workspacePath) {
                this.commits = [];
                return;
            }
            try {
                const commits = yield gitHelper_1.gitHelper.getRecentCommits(workspacePath, 10);
                this.commits = commits;
            }
            catch (e) {
                console.error('[CommitTreeProvider] Failed to load commits:', e);
                this.commits = [];
            }
        });
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        if (this.commits.length === 0) {
            return Promise.resolve([
                new CommitTreeItem({ sha: '', shortSha: '', message: 'No commits found' }, vscode.TreeItemCollapsibleState.None, true)
            ]);
        }
        return Promise.resolve(this.commits.map(commit => new CommitTreeItem(commit, vscode.TreeItemCollapsibleState.None)));
    }
}
exports.CommitTreeProvider = CommitTreeProvider;
class CommitTreeItem extends vscode.TreeItem {
    constructor(commit, collapsibleState, isPlaceholder = false) {
        super(isPlaceholder ? commit.message : `${commit.shortSha} - ${commit.message.substring(0, 50)}`, collapsibleState);
        this.commit = commit;
        this.collapsibleState = collapsibleState;
        this.isPlaceholder = isPlaceholder;
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
        }
        else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
exports.CommitTreeItem = CommitTreeItem;
//# sourceMappingURL=commitTreeProvider.js.map