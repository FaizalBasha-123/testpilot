import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore
import * as JSZip from 'jszip';
import { StagingManager } from '../../../adapters/vscode/stagingManager';
import { FixCodeLensProvider } from '../../../adapters/vscode/fixCodeLensProvider';
import { gitHelper } from '../../../adapters/vscode/gitHelper';
import { TestPilotSidebarProvider } from './sidebarProvider';
import { CommitTracker } from './commitTracker';

// Global instances
const stagingManager = new StagingManager();
const codeLensProvider = new FixCodeLensProvider();
const outputChannel = vscode.window.createOutputChannel("TestPilot");

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating TestPilot...');

    // Initialize Git helper
    await gitHelper.initialize();

    // Initialize Git repository (with delay for API to find repos)
    setTimeout(() => {
        gitHelper.initRepository(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '').catch(e => console.error(e));
    }, 1000);

    // Register Staging Provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(StagingManager.SCHEME, stagingManager)
    );

    // Initialize Commit Tracker
    const commitTracker = new CommitTracker(context);
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        await commitTracker.initialize(workspacePath);
    }
    context.subscriptions.push({ dispose: () => commitTracker.dispose() });

    // Create and register sidebar provider
    const provider = new TestPilotSidebarProvider(context.extensionUri, commitTracker, stagingManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('testpilot.sidebarView', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
    context.subscriptions.push({ dispose: () => provider.dispose() });

    // Always bootstrap repository context as soon as extension activates.
    // This precomputes graph/embedding context in the backend so review latency is lower later.
    provider.startBackgroundContextBuild();

    // Register CodeLens provider
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
    );

    outputChannel.appendLine('[TestPilot] Extension activated successfully');
}

export function deactivate() {
    outputChannel.appendLine('[TestPilot] Extension deactivated');
}
