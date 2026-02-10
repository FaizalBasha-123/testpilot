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
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const stagingManager_1 = require("../../../adapters/vscode/stagingManager");
const fixCodeLensProvider_1 = require("../../../adapters/vscode/fixCodeLensProvider");
const gitHelper_1 = require("../../../adapters/vscode/gitHelper");
const sidebarProvider_1 = require("./sidebarProvider");
const commitTracker_1 = require("./commitTracker");
// Global instances
const stagingManager = new stagingManager_1.StagingManager();
const codeLensProvider = new fixCodeLensProvider_1.FixCodeLensProvider();
const outputChannel = vscode.window.createOutputChannel("TestPilot");
function activate(context) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Activating TestPilot...');
        // Initialize Git helper
        yield gitHelper_1.gitHelper.initialize();
        // Initialize Git repository (with delay for API to find repos)
        setTimeout(() => {
            var _a, _b;
            gitHelper_1.gitHelper.initRepository(((_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath) || '').catch(e => console.error(e));
        }, 1000);
        // Register Staging Provider
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(stagingManager_1.StagingManager.SCHEME, stagingManager));
        // Initialize Commit Tracker
        const commitTracker = new commitTracker_1.CommitTracker(context);
        const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
        if (workspacePath) {
            yield commitTracker.initialize(workspacePath);
        }
        context.subscriptions.push({ dispose: () => commitTracker.dispose() });
        // Create and register sidebar provider
        const provider = new sidebarProvider_1.TestPilotSidebarProvider(context.extensionUri, commitTracker, stagingManager);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('testpilot.sidebarView', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        }));
        context.subscriptions.push({ dispose: () => provider.dispose() });
        // Always bootstrap repository context as soon as extension activates.
        // This precomputes graph/embedding context in the backend so review latency is lower later.
        provider.startBackgroundContextBuild();
        // Register CodeLens provider
        context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider));
        outputChannel.appendLine('[TestPilot] Extension activated successfully');
    });
}
exports.activate = activate;
function deactivate() {
    outputChannel.appendLine('[TestPilot] Extension deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map