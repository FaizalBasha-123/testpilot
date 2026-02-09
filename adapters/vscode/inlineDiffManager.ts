import * as vscode from 'vscode';

// Decoration for ADDTIONS (Green) - Uses native VS Code diff color
const addedLineDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
    isWholeLine: true,
    overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextOverviewRuler'),
    overviewRulerLane: vscode.OverviewRulerLane.Left
});

export interface DiffHunk {
    startLine: number;
    addedLines: { lineNum: number; text?: string }[];
    removedLines: { lineNum: number; text?: string }[];
}

export function parseUnifiedDiff(diffString: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = diffString.split('\n');

    let currentHunk: DiffHunk | null = null;
    let lineNumber = 0;

    for (const line of lines) {
        const hunkMatch = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (hunkMatch) {
            if (currentHunk) hunks.push(currentHunk);
            lineNumber = parseInt(hunkMatch[2], 10) - 1;
            currentHunk = { startLine: lineNumber, addedLines: [], removedLines: [] };
            continue;
        }

        if (!currentHunk) continue;

        if (line.startsWith('+') && !line.startsWith('+++')) {
            currentHunk.addedLines.push({ lineNum: lineNumber, text: line.substring(1) });
            lineNumber++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            currentHunk.removedLines.push({ lineNum: lineNumber, text: line.substring(1) });
        } else if (!line.startsWith('\\')) {
            lineNumber++;
        }
    }
    if (currentHunk) hunks.push(currentHunk);
    return hunks;
}

export class InlineDiffManager {
    // Track phantom decorations to clear them later
    private phantomDecorations: Map<string, vscode.TextEditorDecorationType[]> = new Map();

    public showInlineDiff(editor: vscode.TextEditor, unifiedDiff: string) {
        const hunks = parseUnifiedDiff(unifiedDiff);
        const filePath = editor.document.uri.fsPath;

        // Clean up previous phantoms for this file/editor
        this.clearDecorations(editor);

        const addedRanges: vscode.Range[] = [];
        const newPhantoms: vscode.TextEditorDecorationType[] = [];

        hunks.forEach(hunk => {
            // 1. ADDED Lines (Real Buffer)
            hunk.addedLines.forEach(l => {
                if (l.lineNum < editor.document.lineCount) {
                    addedRanges.push(new vscode.Range(l.lineNum, 0, l.lineNum, 0));
                }
            });

            // 2. REMOVED Lines (Phantom Text)
            // Group deletions by insertion line (lineNum) to handle fragmented hunks correctly
            const deletionsByLine = new Map<number, string[]>();
            hunk.removedLines.forEach(r => {
                if (!deletionsByLine.has(r.lineNum)) {
                    deletionsByLine.set(r.lineNum, []);
                }
                deletionsByLine.get(r.lineNum)!.push(r.text || '');
            });

            deletionsByLine.forEach((texts, lineNum) => {
                const removedText = texts.join('\n');

                // Create decoration for this specific block
                const phantomType = vscode.window.createTextEditorDecorationType({
                    before: {
                        contentText: removedText,
                        backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
                        color: new vscode.ThemeColor('editorCodeLens.foreground'),
                        margin: '0 0 10px 0',
                        textDecoration: 'line-through'
                    },
                    isWholeLine: true
                });

                // Attach to the anchor line
                if (lineNum <= editor.document.lineCount) {
                    const insertLine = Math.min(lineNum, editor.document.lineCount - 1);
                    const range = new vscode.Range(insertLine, 0, insertLine, 0);
                    editor.setDecorations(phantomType, [range]);
                    newPhantoms.push(phantomType);
                }
            });
        });

        // Apply Green for Added
        editor.setDecorations(addedLineDecoration, addedRanges);

        // Store phantoms to dispose later
        this.phantomDecorations.set(filePath, newPhantoms);
    }

    public clearDecorations(editor: vscode.TextEditor) {
        // Clear global green
        editor.setDecorations(addedLineDecoration, []);

        // Dispose all specific phantom types
        const filePath = editor.document.uri.fsPath;
        const phantoms = this.phantomDecorations.get(filePath);
        if (phantoms) {
            phantoms.forEach(d => d.dispose());
            this.phantomDecorations.delete(filePath);
        }
    }
}
