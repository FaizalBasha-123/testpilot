import * as vscode from 'vscode';

/**
 * Fix data structure for PR Agent fixes
 */
export interface PRAgentFix {
    filename: string;
    new_content: string;
    unified_diff: string;
    original_content: string;
    issues_fixed: number;
    issue_line?: number;  // First issue line for CodeLens placement
    issue_message?: string;  // Preview message
}

/**
 * Provides CodeLens buttons at the issue line (not file top).
 * Implements the "Cursor/Continue" experience with Accept/Reject/View.
 */
export class FixCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    // Map: filePath -> Fix data
    private pendingFixes: Map<string, PRAgentFix> = new Map();

    /**
     * Registers a pending fix for a file.
     */
    public setPendingFix(filePath: string, fix: PRAgentFix) {
        this.pendingFixes.set(filePath, fix);
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Clears a pending fix for a file.
     */
    public clearFix(filePath: string) {
        this.pendingFixes.delete(filePath);
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Checks if a file has a pending fix.
     */
    public hasPendingFix(filePath: string): boolean {
        return this.pendingFixes.has(filePath);
    }

    /**
     * Gets the pending fix for a file.
     */
    public getPendingFix(filePath: string): PRAgentFix | undefined {
        return this.pendingFixes.get(filePath);
    }

    /**
     * Clears all pending fixes.
     */
    public clearAll() {
        this.pendingFixes.clear();
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const filePath = document.uri.fsPath;
        const fix = this.pendingFixes.get(filePath);

        if (!fix) return [];

        // Place CodeLens at issue line (default to 0 if not specified)
        const issueLine = Math.max(0, (fix.issue_line || 1) - 1);  // Convert to 0-indexed
        const range = new vscode.Range(issueLine, 0, issueLine, 0);

        const lenses: vscode.CodeLens[] = [];

        // Issue message preview (if available)
        if (fix.issue_message) {
            lenses.push(new vscode.CodeLens(range, {
                title: `🔴 ${fix.issue_message.substring(0, 50)}...`,
                command: ""
            }));
        }

        // Accept button
        lenses.push(new vscode.CodeLens(range, {
            title: `✅ Accept (${fix.issues_fixed || 1})`,
            command: "blackbox.acceptInlineFix",
            arguments: [filePath]
        }));

        // Accept & Commit button (Git integration)
        lenses.push(new vscode.CodeLens(range, {
            title: "✅ Accept & Commit",
            command: "blackbox.acceptAndCommit",
            arguments: [filePath]
        }));

        // Reject button
        lenses.push(new vscode.CodeLens(range, {
            title: "❌ Reject",
            command: "blackbox.rejectInlineFix",
            arguments: [filePath]
        }));

        // View Diff button
        lenses.push(new vscode.CodeLens(range, {
            title: "👁️ Diff",
            command: "blackbox.viewDiff",
            arguments: [filePath]
        }));

        return lenses;
    }
}
