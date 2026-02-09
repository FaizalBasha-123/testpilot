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
exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
// @ts-ignore
const JSZip = require("jszip");
const stagingManager_1 = require("./stagingManager"); // NEW: Kilo-style staging
const fixCodeLensProvider_1 = require("./fixCodeLensProvider");
const gitHelper_1 = require("./gitHelper");
// Use CommonJS require for node-fetch v2 (Standard for VS Code extensions)
const fetch = require('node-fetch');
const FormData = require('form-data');
// Global instances
const stagingManager = new stagingManager_1.StagingManager();
const codeLensProvider = new fixCodeLensProvider_1.FixCodeLensProvider();
// [Phoenix] Output Channel for Deep Logging
const outputChannel = vscode.window.createOutputChannel("Blackbox Tester");
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Activating BlackboxTester (Refactored)...');
        // Initialize Git helper
        yield gitHelper_1.gitHelper.initialize();
        // [Phoenix] Initialize Secure Git Controller (Via API Helper)
        // Wait for API to find repos (sometimes takes a tick)
        setTimeout(() => {
            var _a;
            gitHelper_1.gitHelper.initRepository(((_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0].uri.fsPath) || '').catch(e => console.error(e));
        }, 1000);
        // Register Staging Provider (Original Content for Left Side of Diff)
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(stagingManager_1.StagingManager.SCHEME, stagingManager));
        const provider = new BlackboxChatProvider(context.extensionUri, stagingManager, codeLensProvider);
        // [Fix 1: Background Retention] - Keep Webview alive
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('blackbox.chatView', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        }));
        // Register CodeLens (Legacy wrapper, mostly unused now in favor of Webview buttons, but kept for inline access)
        context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider));
        context.subscriptions.push(vscode.commands.registerCommand('blackbox.scanWorkspace', () => __awaiter(this, void 0, void 0, function* () {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace open');
                return;
            }
            const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            // [Phoenix] Master Workflow: Ensure Git & Create Safe State
            outputChannel.appendLine('[Extension] Initiating Master Git Workflow...');
            const res = yield gitHelper_1.gitHelper.ensureGitAndCommit(rootPath);
            outputChannel.appendLine(`[Extension] Git Action Result: ${JSON.stringify(res)}`);
            let gitAction = 'Action Failed';
            if (res.success) {
                if (res.action === 'commit')
                    gitAction = 'Snapshot Created (Safe State)';
                else if (res.action === 'none')
                    gitAction = 'No Pending Changes (Safe)';
                else if (res.action === 'initialized')
                    gitAction = 'Repo Initialized & Snapshot';
            }
            else {
                vscode.window.showErrorMessage(`Git Setup Failed: ${res.error}`);
                // [Fix] Tell Webview to stop loading so it doesn't hang on "Pending..."
                provider.sendErrorToWebview(`Git Setup Failed: ${res.error}`);
                return; // Stop if we can't ensure a valid git state
            }
            // [Phoenix] Git Context for AI
            // 1. Git Log (History/Intent) - User requested COMPLETE history with Diffs
            const gitLog = yield gitHelper_1.gitHelper.getLog(rootPath, 0);
            // 2. Git Diff (Actual Code Changes to Review)
            const validationContext = yield gitHelper_1.gitHelper.getValidationContext(rootPath);
            const gitDiff = validationContext.diff;
            // [Phoenix] Deep Logging for User Verification
            outputChannel.appendLine(`[Extension] Analyzing Range: ${validationContext.range}`);
            outputChannel.appendLine('[Extension] Commits Included in Scan:');
            validationContext.commits.forEach(c => outputChannel.appendLine(`  > ${c}`));
            outputChannel.appendLine(`[Extension] Deep Log - Git Diff Length: ${gitDiff.length}`);
            outputChannel.appendLine(`[Extension] Deep Log - Git Diff Preview: ${gitDiff.substring(0, 500)}`);
            outputChannel.appendLine(`[Extension] Deep Log - Git Diff (Full): ${gitDiff}`); // Full log for deep debug
            outputChannel.show(true); // Bring to front so user sees it
            yield provider.requestWorkspaceScan(rootPath, gitAction, gitLog, gitDiff);
        })));
    });
}
exports.activate = activate;
class BlackboxChatProvider {
    constructor(_extensionUri, _stagingManager, _codeLensProvider) {
        this._extensionUri = _extensionUri;
        this._stagingManager = _stagingManager;
        this._codeLensProvider = _codeLensProvider;
        this._fixesCache = new Map();
        // [BlackboxTester] Persistent Polling Mechanism
        this._activeJobId = null;
        this._pollingInterval = null;
        this._lastLogIndex = 0; // Track printed logs
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.description = "Blackbox Tester";
        webviewView.webview.html = this._getHtmlForWebview();
        webviewView.webview.onDidReceiveMessage((data) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (data.type === 'scanWorkspace') {
                vscode.commands.executeCommand('blackbox.scanWorkspace');
            }
            if (data.type === 'openDiff') {
                this.openDiff(data.filename, this._fixesCache.get(data.filename));
            }
            if (data.type === 'cancelJob') {
                if (data.jobId)
                    this.cancelJob(data.jobId);
            }
            // NEW: Global Approve/Reject from Side Panel
            if (data.type === 'approveActive') {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    yield this._stagingManager.acceptChange(editor.document.uri.fsPath);
                    // [Phoenix] Post-Accept Snapshot (API)
                    yield gitHelper_1.gitHelper.stageAndCommit(editor.document.uri.fsPath, `Phoenix: Fix Approved - ${path.basename(editor.document.uri.fsPath)}`);
                }
                else {
                    vscode.window.showWarningMessage("No active editor to approve.");
                }
                (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({ type: 'resetUI' });
            }
            if (data.type === 'rejectActive') {
                const choice = yield vscode.window.showWarningMessage("This will REVERT all changes made by the AI (Reset to Safe Snapshot). Are you sure?", "Yes, Revert", "Cancel");
                if (choice === "Yes, Revert") {
                    const root = (_b = vscode.workspace.workspaceFolders) === null || _b === void 0 ? void 0 : _b[0].uri.fsPath;
                    if (root)
                        yield gitHelper_1.gitHelper.revertToSnapshot(root);
                    (_c = this._view) === null || _c === void 0 ? void 0 : _c.webview.postMessage({ type: 'resetUI' });
                }
            }
            // Legacy individual accept
            if (data.type === 'acceptFix') {
                yield this._stagingManager.acceptChange(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, data.filename));
            }
            if (data.type === 'openFile') {
                this.openFile(data.file, data.line);
            }
            // [Phase 2] Chat Message Handler
            if (data.type === 'chatMessage') {
                const userText = data.text;
                // Currently just an echo, but this is the hook for "Talk to Repo"
                // Simulate AI Typing
                setTimeout(() => {
                    var _a;
                    (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({
                        type: 'chatResponse',
                        html: `I received: "${userText}". <br><em>(Conversational AI coming in Phase 2.2)</em>`
                    });
                }, 1000);
            }
        }));
    }
    startPolling(jobId) {
        this._activeJobId = jobId;
        if (this._pollingInterval)
            clearInterval(this._pollingInterval);
        this._pollingInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this._activeJobId) {
                this.stopPolling();
                return;
            }
            try {
                const config = vscode.workspace.getConfiguration('blackbox');
                const backendUrl = config.get('backendUrl', 'http://localhost:3000');
                const statusUrl = `${backendUrl}/api/v1/ide/job_status/${this._activeJobId}`;
                const response = yield fetch(statusUrl);
                if (response.ok) {
                    const data = yield response.json();
                    const statusData = data;
                    // [Phoenix] Forward Deep Logs to Output Channel
                    if (statusData.logs && Array.isArray(statusData.logs)) {
                        const newLogs = statusData.logs.slice(this._lastLogIndex);
                        if (newLogs.length > 0) {
                            newLogs.forEach((log) => {
                                // Filter mostly for relevant debug info to avoid spam, or log all if deep debug
                                if (log.includes('[Deep Log]') || log.includes('[AI RAW DEBUG]') || log.includes('[Debug]') || log.includes('[FLOW TRACE]')) {
                                    outputChannel.appendLine(log);
                                }
                            });
                            this._lastLogIndex = statusData.logs.length;
                        }
                    }
                    (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({
                        type: 'jobStatusUpdate',
                        data: statusData
                    });
                    if (statusData.status === 'completed') {
                        if (statusData.result) {
                            outputChannel.appendLine('[Extension] Job Completed. Fixes received.');
                            this.handleJobCompletion(statusData.result);
                        }
                        this.stopPolling();
                    }
                    else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
                        outputChannel.appendLine(`[Extension] Job Failed/Cancelled: ${statusData.status}`);
                        this.stopPolling();
                    }
                }
            }
            catch (err) {
                console.error("[Extension] Polling error:", err);
                outputChannel.appendLine(`[Extension] Polling Error: ${err}`);
            }
        }), 2000);
    }
    stopPolling() {
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = null;
        }
        this._activeJobId = null;
        this._lastLogIndex = 0;
    }
    handleJobCompletion(result) {
        var _a;
        this._fixesCache.clear();
        this._codeLensProvider.clearAll();
        const rootPath = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0].uri.fsPath;
        if (!rootPath)
            return;
        if (result.fixes && Array.isArray(result.fixes)) {
            for (const fix of result.fixes) {
                // CLEANUP: Strip line numbers (e.g. " 1 | code") if present
                let cleanContent = fix.new_content;
                if (cleanContent && /^\s*\d+\s*\|/m.test(cleanContent)) {
                    cleanContent = cleanContent
                        .split('\n')
                        .map((line) => line.replace(/^\s*\d+\s*\|\s?/, ''))
                        .join('\n');
                }
                this._fixesCache.set(fix.filename, {
                    newContent: cleanContent,
                    unifiedDiff: fix.unified_diff || '',
                    originalContent: fix.original_content || ''
                });
                // [Auto-Apply] Stage the file immediately (Live Edit) but suppression Diff View
                if (rootPath) {
                    const absPath = path.join(rootPath, fix.filename);
                    // Using a small delay or sync might be needed if too many files, but async is fine
                    this._stagingManager.stageFile(absPath, cleanContent, false).catch(e => console.error(e));
                }
            }
        }
    }
    cancelJob(jobId) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                outputChannel.appendLine(`[Extension] Cancelling Job: ${jobId}...`);
                this.stopPolling();
                const config = vscode.workspace.getConfiguration('blackbox');
                const backendUrl = config.get('backendUrl', 'http://localhost:3000');
                yield fetch(`${backendUrl}/api/v1/ide/cancel/${jobId}`, { method: 'POST' });
                (_a = this._view) === null || _a === void 0 ? void 0 : _a.webview.postMessage({
                    type: 'jobStatusUpdate',
                    data: { status: 'cancelled', logs: ['Job Cancelled by User.'] }
                });
                outputChannel.appendLine('[Extension] Job Cancellation Confirmed.');
            }
            catch (e) {
                console.error('Cancel Failed:', e);
                outputChannel.appendLine(`[Extension] Cancel Request Failed: ${e}`);
            }
        });
    }
    openFile(filename, line) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const rootPath = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0].uri.fsPath;
            if (!rootPath)
                return;
            let relativePath = filename;
            if (filename.includes(':')) {
                relativePath = filename.split(':').pop() || filename;
            }
            const filePath = path.join(rootPath, relativePath);
            try {
                const doc = yield vscode.workspace.openTextDocument(filePath);
                const editor = yield vscode.window.showTextDocument(doc);
                const lineNum = Math.max(0, (line || 1) - 1);
                const range = new vscode.Range(lineNum, 0, lineNum, 0);
                editor.selection = new vscode.Selection(lineNum, 0, lineNum, 0);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
            catch (e) {
                vscode.window.showErrorMessage(`Could not open file: ${relativePath}`);
            }
        });
    }
    requestWorkspaceScan(rootPath, gitAction, gitLog, gitDiff) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._view) {
                return;
            }
            this._view.webview.postMessage({ type: 'status', value: 'Zipping Workspace...' });
            // Show Git Status in UI
            this._view.webview.postMessage({ type: 'gitStatus', value: gitAction, gitLog: gitLog });
            (_b = (_a = this._view).show) === null || _b === void 0 ? void 0 : _b.call(_a, true);
            try {
                const zip = new JSZip();
                yield this._addFolderToZip(zip, rootPath, rootPath);
                const content = yield zip.generateAsync({ type: 'nodebuffer' });
                this._view.webview.postMessage({ type: 'status', value: 'Uploading & Scanning...' });
                const config = vscode.workspace.getConfiguration('blackbox');
                const backendUrl = config.get('backendUrl', 'http://localhost:3000');
                const form = new FormData();
                form.append('file', content, 'repo.zip');
                // [Phoenix] Send Git Log Context
                if (gitLog) {
                    form.append('git_log', gitLog);
                }
                // [Phoenix] Send Git Diff (Changes to Review)
                if (gitDiff) {
                    form.append('git_diff', gitDiff);
                }
                const response = yield fetch(`${backendUrl}/api/v1/ide/review_repo_async`, {
                    method: 'POST',
                    body: form,
                    headers: form.getHeaders()
                });
                if (!response.ok)
                    throw new Error(response.statusText);
                const { job_id } = yield response.json();
                // [Phoenix] Sync Job ID to Webview immediately so "Kill Analysis" works
                this._view.webview.postMessage({ type: 'jobStarted', jobId: job_id });
                this.startPolling(job_id);
                this._fixesCache.clear();
                this._codeLensProvider.clearAll();
            }
            catch (error) {
                this._view.webview.postMessage({ type: 'error', value: String(error.message || error) });
            }
        });
    }
    // [Phoenix] Error Reporting to Webview
    sendErrorToWebview(errorMessage) {
        if (!this._view)
            return;
        this._view.webview.postMessage({ type: 'error', value: errorMessage });
    }
    // KILO-STYLE: Open Diff using Staging Manager
    openDiff(filename, fixData) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!fixData)
                return;
            const rootPath = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0].uri.fsPath;
            if (!rootPath)
                return;
            const filePath = path.join(rootPath, filename);
            // Populate Cache
            if (!this._fixesCache.has(filename)) {
                this._fixesCache.set(filename, fixData);
            }
            // Use Staging Manager to open Kilo-style Side-by-Side Diff
            yield this._stagingManager.stageFile(filePath, fixData.newContent);
        });
    }
    _addFolderToZip(zip, folderPath, rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const entries = yield fs.promises.readdir(folderPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(folderPath, entry.name);
                const relPath = path.relative(rootPath, fullPath);
                if (entry.isDirectory()) {
                    if (['.git', 'node_modules', 'dist', 'out', '__pycache__', '.vscode', 'sonarqube', 'sonar-java', '.next', 'build', 'coverage', '.checkpoints'].includes(entry.name))
                        continue;
                    yield this._addFolderToZip(zip, fullPath, rootPath);
                }
                else {
                    try {
                        const content = yield fs.promises.readFile(fullPath);
                        zip.file(relPath, content);
                    }
                    catch (error) { }
                }
            }
        });
    }
    _getHtmlForWebview() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' var(--vscode-font-family); font-src var(--vscode-font-family); script-src 'unsafe-inline';">
            <style>
                :root {
                    --user-msg-bg: #005fb8;
                    --ai-msg-bg: #2b2b2b;
                    --bg-color: #1e1e1e;
                    --input-bg: #2d2d2d;
                    --text-color: #cccccc;
                }
                body { 
                    font-family: var(--vscode-font-family, 'Segoe UI', sans-serif); 
                    margin: 0; padding: 0;
                    color: var(--text-color); 
                    background-color: var(--bg-color); 
                    display: flex; flex-direction: column; height: 100vh;
                }
                
                /* Chat Container */
                #chat-history {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                /* Message Bubbles */
                .message {
                    max-width: 85%;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 1.4;
                    position: relative;
                    word-wrap: break-word;
                }
                .message.user {
                    align-self: flex-end;
                    background-color: var(--user-msg-bg);
                    color: white;
                    border-bottom-right-radius: 2px;
                }
                .message.ai {
                    align-self: flex-start;
                    background-color: var(--ai-msg-bg);
                    border: 1px solid #3d3d3d;
                    border-bottom-left-radius: 2px;
                }
                
                /* Interactive Cards (embedded in AI messages) */
                .card {
                    background: #181818;
                    border: 1px solid #333;
                    border-radius: 6px;
                    margin-top: 8px;
                    overflow: hidden;
                }
                .card-header {
                    padding: 8px 12px;
                    background: #252526;
                    font-weight: 600;
                    font-size: 12px;
                    border-bottom: 1px solid #333;
                }
                .card-body {
                    padding: 10px;
                }
                
                /* Input Area */
                #input-area {
                    padding: 15px;
                    background: #252526;
                    border-top: 1px solid #333;
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                }
                textarea {
                    flex: 1;
                    background: var(--input-bg);
                    border: 1px solid #3d3d3d;
                    color: white;
                    border-radius: 4px;
                    padding: 8px;
                    font-family: inherit;
                    resize: none;
                    height: 36px;
                    max-height: 100px;
                    outline: none;
                }
                textarea:focus { border-color: #007fd4; }
                
                button.send-btn {
                    background: #007fd4;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    width: 36px;
                    height: 36px;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                }
                button.send-btn:hover { background: #0060a0; }
                
                /* Utility Buttons */
                .btn {
                    background: #3c3c3c;
                    border: 1px solid #555;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 5px;
                }
                .btn:hover { background: #4c4c4c; }
                .btn-primary { background: #0e639c; border-color: #1177bb; }
                .btn-primary:hover { background: #1177bb; }

                /* Typing Indicator */
                .typing {
                    font-style: italic; color: #888; font-size: 12px; margin-left: 5px;
                }
            </style>
        </head>
        <body>
            <div id="chat-history">
                <div class="message ai">
                    Hello! I'm your AI Code Reviewer paired with <strong>Blackbox Tester</strong>. 
                    <br><br>
                    You can ask me to:
                    <br>• Review your changes (<code>/review</code>)
                    <br>• Scan the workspace (<code>/scan</code>)
                    <br>• Help fix a bug
                </div>
            </div>
            
            <div id="input-area">
                <textarea id="chat-input" placeholder="Ask something or type /review..." rows="1"></textarea>
                <button class="send-btn" onclick="sendMessage()">➤</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const chatHistory = document.getElementById('chat-history');
                const chatInput = document.getElementById('chat-input');
                
                // Auto-resize textarea
                chatInput.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight) + 'px';
                });

                // Enter to send
                chatInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                function sendMessage() {
                    const text = chatInput.value.trim();
                    if (!text) return;
                    
                    addMessage(text, 'user');
                    chatInput.value = '';
                    chatInput.style.height = '36px';
                    
                    // Logic for Slash Commands
                    if (text === '/review' || text === '/scan') {
                        vscode.postMessage({ type: 'scanWorkspace' });
                        addMessage("Starting workspace scan... 🕵️", 'ai');
                    } else {
                        // Echo for now (Phase 2.1)
                        // setTimeout(() => addMessage("I'm learning to chat! Try /review for now.", 'ai'), 500);
                        vscode.postMessage({ type: 'chatMessage', text: text });
                    }
                }

                function addMessage(html, sender) {
                    const div = document.createElement('div');
                    div.className = 'message ' + sender;
                    div.innerHTML = html;
                    chatHistory.appendChild(div);
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }

                // Handle Incoming Messages (from Extension)
                window.addEventListener('message', event => {
                    const msg = event.data;
                    
                    if (msg.type === 'status') {
                        // Optional: Show status as a small toast or non-persistent message
                        // addMessage("Status: " + msg.value, 'ai');
                    }
                    
                    if (msg.type === 'jobStarted') {
                        addMessage("Job Started! ID: " + msg.jobId, 'ai');
                    }

                    if (msg.type === 'chatResponse') {
                        addMessage(msg.html, 'ai');
                    }
                    
                    if (msg.type === 'jobStatusUpdate') {
                        const data = msg.data;
                        if (data.status === 'completed' && data.result) {
                            renderTheResult(data.result);
                        } else if (data.status === 'failed') {
                            addMessage("❌ Job Failed: " + (data.error || 'Unknown error'), 'ai');
                        }
                    }
                    
                    if (msg.type === 'error') {
                        addMessage("Error: " + msg.value, 'ai');
                    }
                });
                
                function renderTheResult(result) {
                    let html = "<strong>Analysis Complete!</strong><br>";
                    const fixes = result.fixes || [];
                    const sonar = result.sonar_data || [];
                    
                    html += "Found " + sonar.length + " vulnerabilities and proposed " + fixes.length + " fixes.<br>";
                    
                    if (fixes.length > 0) {
                        html += '<div class="card"><div class="card-header">Proposed Fixes</div><div class="card-body">';
                        fixes.forEach(fix => {
                            const safeName = fix.filename.replace(/\\\\/g, '\\\\\\\\');
                            html += '<button class="btn btn-primary" style="width:100%; margin-bottom:5px; text-align:left;" onclick="openDiff(\\'' + safeName + '\\')">📄 ' + fix.filename + '</button>';
                        });
                        html += '</div></div>';
                        
                        html += '<div style="margin-top:10px;">';
                        html += '<button class="btn" onclick="approveAll()" style="color:#4caf50; border-color:#4caf50;">✅ Approve All</button> ';
                        html += '<button class="btn" onclick="rejectAll()" style="color:#f44336; border-color:#f44336;">❌ Reject All</button>';
                        html += '</div>';
                    }
                    
                    addMessage(html, 'ai');
                }

                function openDiff(filename) { vscode.postMessage({ type: 'openDiff', filename }); }
                function approveAll() { vscode.postMessage({ type: 'approveActive' }); addMessage("Approved changes.", 'user'); }
                function rejectAll() { vscode.postMessage({ type: 'rejectActive' }); addMessage("Rejected changes.", 'user'); }
            </script>
        </body>
        </html>`;
    }
}
//# sourceMappingURL=extension.js.map