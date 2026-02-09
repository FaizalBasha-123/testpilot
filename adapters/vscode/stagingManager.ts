import * as vscode from 'vscode';
import * as path from 'path';

export class StagingManager implements vscode.TextDocumentContentProvider {
    // Scheme for original content (Left side of Diff)
    public static readonly SCHEME = 'blackbox-original';

    // Store staged state: FilePath -> Original Content
    private privateStagedState: Map<string, string> = new Map();

    // Event emitter for content provider
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidChange = this._onDidChange.event;

    // Provide content for the "Left Side" of the diff (Original State)
    provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        return this.privateStagedState.get(uri.fsPath) || '';
    }

    /**
     * Stage a fix: 
     * 1. Store original content.
     * 2. Apply changes to the active document (Dirty Buffer).
     * 3. Open Side-by-Side Diff.
     */
    public async stageFile(filePath: string, newContent: string, showDiff: boolean = true) {
        const fileUri = vscode.Uri.file(filePath);

        // 1. Read and Store Original Content (Snapshotted) - ONLY IF NOT ALREADY STAGED
        if (!this.privateStagedState.has(filePath)) {
            try {
                // Force read from disk (using fs) to ensure we get clean content, or revert first? 
                // vscode.workspace.openTextDocument returns the *opened* document, which might be dirty.
                // Best practice: Read from fs if possible, or assume it was clean before we started.
                // For now, assume clean start.
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const originalContent = doc.getText();
                this.privateStagedState.set(filePath, originalContent);
            } catch (e) {
                this.privateStagedState.set(filePath, '');
            }
        }

        // 2. Prepare the Diff View URIs
        const originalUri = vscode.Uri.parse(`${StagingManager.SCHEME}:${filePath}`);
        const modifiedUri = fileUri;

        // 3. Apply the Edit to the Live Document (In-Memory)
        const doc = await vscode.workspace.openTextDocument(modifiedUri);
        const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length)
        );

        const edit = new vscode.WorkspaceEdit();
        edit.replace(modifiedUri, fullRange, newContent);
        await vscode.workspace.applyEdit(edit); // File is now DIRTY (Staged)

        // 4. Open the Diff Editor (Kilo Style) - Optional
        if (showDiff) {
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                modifiedUri,
                `Review: ${path.basename(filePath)}`
            );
        }
    }

    /**
     * Accept: Just Save the dirty file.
     */
    public async acceptChange(filePath: string) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await doc.save();
        this.privateStagedState.delete(filePath);
        vscode.window.showInformationMessage(`✅ Approved changes for ${path.basename(filePath)}`);

        // Close Diff Editor? (Optional, users might want to keep it or it will close naturally)
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }

    /**
     * Reject: Revert the dirty file to Original state.
     */
    public async rejectChange(filePath: string) {
        const original = this.privateStagedState.get(filePath);
        if (original === undefined) return;

        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);

        const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length)
        );

        const edit = new vscode.WorkspaceEdit();
        edit.replace(uri, fullRange, original);
        await vscode.workspace.applyEdit(edit); // Reverted (but might still be 'dirty' relative to disk if we don't save)

        // We should save it to make it "Clean" again (matching disk)
        await doc.save();

        this.privateStagedState.delete(filePath);
        vscode.window.showInformationMessage(`❌ Rejected changes for ${path.basename(filePath)}`);

        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }

    public isStaged(filePath: string): boolean {
        return this.privateStagedState.has(filePath);
    }
}
