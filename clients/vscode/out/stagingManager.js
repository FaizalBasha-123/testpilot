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
exports.StagingManager = void 0;
const vscode = require("vscode");
const path = require("path");
class StagingManager {
    constructor() {
        // Store staged state: FilePath -> Original Content
        this.privateStagedState = new Map();
        // Event emitter for content provider
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }
    // Provide content for the "Left Side" of the diff (Original State)
    provideTextDocumentContent(uri) {
        return this.privateStagedState.get(uri.fsPath) || '';
    }
    /**
     * Stage a fix:
     * 1. Store original content.
     * 2. Apply changes to the active document (Dirty Buffer).
     * 3. Open Side-by-Side Diff.
     */
    stageFile(filePath, newContent, showDiff = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileUri = vscode.Uri.file(filePath);
            // 1. Read and Store Original Content (Snapshotted) - ONLY IF NOT ALREADY STAGED
            if (!this.privateStagedState.has(filePath)) {
                try {
                    // Force read from disk (using fs) to ensure we get clean content, or revert first? 
                    // vscode.workspace.openTextDocument returns the *opened* document, which might be dirty.
                    // Best practice: Read from fs if possible, or assume it was clean before we started.
                    // For now, assume clean start.
                    const doc = yield vscode.workspace.openTextDocument(fileUri);
                    const originalContent = doc.getText();
                    this.privateStagedState.set(filePath, originalContent);
                }
                catch (e) {
                    this.privateStagedState.set(filePath, '');
                }
            }
            // 2. Prepare the Diff View URIs
            const originalUri = vscode.Uri.parse(`${StagingManager.SCHEME}:${filePath}`);
            const modifiedUri = fileUri;
            // 3. Apply the Edit to the Live Document (In-Memory)
            const doc = yield vscode.workspace.openTextDocument(modifiedUri);
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            const edit = new vscode.WorkspaceEdit();
            edit.replace(modifiedUri, fullRange, newContent);
            yield vscode.workspace.applyEdit(edit); // File is now DIRTY (Staged)
            // 4. Open the Diff Editor (Kilo Style) - Optional
            if (showDiff) {
                yield vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, `Review: ${path.basename(filePath)}`);
            }
        });
    }
    /**
     * Accept: Just Save the dirty file.
     */
    acceptChange(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const doc = yield vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            yield doc.save();
            this.privateStagedState.delete(filePath);
            vscode.window.showInformationMessage(`✅ Approved changes for ${path.basename(filePath)}`);
            // Close Diff Editor? (Optional, users might want to keep it or it will close naturally)
            yield vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
    }
    /**
     * Reject: Revert the dirty file to Original state.
     */
    rejectChange(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const original = this.privateStagedState.get(filePath);
            if (original === undefined)
                return;
            const uri = vscode.Uri.file(filePath);
            const doc = yield vscode.workspace.openTextDocument(uri);
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, fullRange, original);
            yield vscode.workspace.applyEdit(edit); // Reverted (but might still be 'dirty' relative to disk if we don't save)
            // We should save it to make it "Clean" again (matching disk)
            yield doc.save();
            this.privateStagedState.delete(filePath);
            vscode.window.showInformationMessage(`❌ Rejected changes for ${path.basename(filePath)}`);
            yield vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
    }
    isStaged(filePath) {
        return this.privateStagedState.has(filePath);
    }
}
exports.StagingManager = StagingManager;
// Scheme for original content (Left side of Diff)
StagingManager.SCHEME = 'blackbox-original';
//# sourceMappingURL=stagingManager.js.map