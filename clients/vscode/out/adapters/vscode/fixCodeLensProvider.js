"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixCodeLensProvider = void 0;
const vscode = require("vscode");
/**
 * Provides CodeLens buttons at the issue line (not file top).
 * Implements the "Cursor/Continue" experience with Accept/Reject/View.
 */
class FixCodeLensProvider {
    constructor() {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
        // Map: filePath -> Fix data
        this.pendingFixes = new Map();
    }
    /**
     * Registers a pending fix for a file.
     */
    setPendingFix(filePath, fix) {
        this.pendingFixes.set(filePath, fix);
        this._onDidChangeCodeLenses.fire();
    }
    /**
     * Clears a pending fix for a file.
     */
    clearFix(filePath) {
        this.pendingFixes.delete(filePath);
        this._onDidChangeCodeLenses.fire();
    }
    /**
     * Checks if a file has a pending fix.
     */
    hasPendingFix(filePath) {
        return this.pendingFixes.has(filePath);
    }
    /**
     * Gets the pending fix for a file.
     */
    getPendingFix(filePath) {
        return this.pendingFixes.get(filePath);
    }
    /**
     * Clears all pending fixes.
     */
    clearAll() {
        this.pendingFixes.clear();
        this._onDidChangeCodeLenses.fire();
    }
    provideCodeLenses(document) {
        const filePath = document.uri.fsPath;
        const fix = this.pendingFixes.get(filePath);
        if (!fix)
            return [];
        // Place CodeLens at issue line (default to 0 if not specified)
        const issueLine = Math.max(0, (fix.issue_line || 1) - 1); // Convert to 0-indexed
        const range = new vscode.Range(issueLine, 0, issueLine, 0);
        const lenses = [];
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
exports.FixCodeLensProvider = FixCodeLensProvider;
//# sourceMappingURL=fixCodeLensProvider.js.map