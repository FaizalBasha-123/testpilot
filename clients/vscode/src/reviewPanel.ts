import * as vscode from 'vscode';

export interface ReviewResult {
    summary: string;
    score: number;
    issues: ReviewIssue[];
    suggestions: ReviewSuggestion[];
}

export interface ReviewIssue {
    severity: 'error' | 'warning' | 'info';
    description: string;
    file?: string;
    line?: number;
}

export interface ReviewSuggestion {
    description: string;
    file?: string;
    line?: number;
}

export class ReviewPanel {
    public static currentPanel: ReviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'openFile') {
                    this.openFile(message.file, message.line);
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(result: ReviewResult, commitSha: string) {
        const column = vscode.ViewColumn.Beside;

        if (ReviewPanel.currentPanel) {
            ReviewPanel.currentPanel._panel.reveal(column);
            ReviewPanel.currentPanel.update(result, commitSha);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'testpilotReview',
            `TestPilot Review: ${commitSha.substring(0, 7)}`,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ReviewPanel.currentPanel = new ReviewPanel(panel);
        ReviewPanel.currentPanel.update(result, commitSha);
    }

    private async openFile(file: string, line?: number) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot || !file) return;

        try {
            const path = require('path');
            const filePath = path.join(workspaceRoot, file);
            const doc = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

            if (line && line > 0) {
                const lineNum = line - 1;
                const range = new vscode.Range(lineNum, 0, lineNum, 0);
                editor.selection = new vscode.Selection(lineNum, 0, lineNum, 0);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Could not open file: ${file}`);
        }
    }

    public update(result: ReviewResult, commitSha: string) {
        this._panel.webview.html = this.getHtml(result, commitSha);
    }

    private getHtml(result: ReviewResult, commitSha: string): string {
        const scoreEmoji = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
        const scoreColor = result.score >= 80 ? '#4caf50' : result.score >= 60 ? '#ff9800' : '#f44336';

        const issuesHtml = result.issues.length > 0
            ? result.issues.map(issue => {
                const badge = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
                const fileLink = issue.file
                    ? `<a href="#" onclick="openFile('${issue.file}', ${issue.line || 0})">${issue.file}${issue.line ? `:${issue.line}` : ''}</a>`
                    : '';
                return `<li>${badge} ${issue.description} ${fileLink}</li>`;
            }).join('')
            : '<li style="color: #888;">No issues found</li>';

        const suggestionsHtml = result.suggestions.length > 0
            ? result.suggestions.map(s => {
                const fileLink = s.file
                    ? `<a href="#" onclick="openFile('${s.file}', ${s.line || 0})">${s.file}</a>`
                    : '';
                return `<li>💡 ${s.description} ${fileLink}</li>`;
            }).join('')
            : '<li style="color: #888;">No suggestions</li>';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .score {
            font-size: 48px;
            font-weight: bold;
            color: ${scoreColor};
        }
        .summary {
            font-size: 16px;
            color: var(--vscode-descriptionForeground);
        }
        .commit-sha {
            font-family: monospace;
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
        }
        h2 {
            margin-top: 25px;
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--vscode-descriptionForeground);
        }
        ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        li {
            padding: 8px 12px;
            margin: 5px 0;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            margin-left: 8px;
        }
        a:hover {
            text-decoration: underline;
        }
        .dismiss-btn {
            margin-top: 30px;
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .dismiss-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="score">${scoreEmoji} ${result.score}</div>
        <div>
            <div class="summary">${result.summary}</div>
            <div class="commit-sha">${commitSha}</div>
        </div>
    </div>

    <h2>Issues</h2>
    <ul>${issuesHtml}</ul>

    <h2>Suggestions</h2>
    <ul>${suggestionsHtml}</ul>

    <button class="dismiss-btn" onclick="closePanel()">Dismiss</button>

    <script>
        const vscode = acquireVsCodeApi();
        
        function openFile(file, line) {
            vscode.postMessage({ command: 'openFile', file: file, line: line });
        }
        
        function closePanel() {
            vscode.postMessage({ command: 'close' });
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        ReviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}
