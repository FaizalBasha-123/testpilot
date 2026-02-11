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
exports.SecurityAnalyzer = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
// @ts-ignore
const JSZip = require("jszip");
const gitHelper_1 = require("../../../adapters/vscode/gitHelper");
const fetch = require('node-fetch');
const FormData = require('form-data');
/**
 * Handles security analysis: zip → upload → poll → fixes
 */
class SecurityAnalyzer {
    constructor(stagingManager) {
        this._activeJobId = null;
        this._pollingInterval = null;
        this._stagingManager = stagingManager;
        this._outputChannel = vscode.window.createOutputChannel('TestPilot Security');
    }
    startAnalysis(onUpdate) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!workspacePath) {
                onUpdate({ status: 'failed', findings: [], fixes: [], logs: [], error: 'No workspace open' });
                return;
            }
            onUpdate({ status: 'running', findings: [], fixes: [], logs: ['Zipping workspace...'] });
            try {
                // Zip the workspace
                const zip = new JSZip();
                yield this._addFolderToZip(zip, workspacePath, workspacePath);
                const content = yield zip.generateAsync({ type: 'nodebuffer' });
                onUpdate({ status: 'running', findings: [], fixes: [], logs: ['Uploading to analysis server...'] });
                // Get backend URL
                const config = vscode.workspace.getConfiguration('testpilot');
                const backendUrl = config.get('backendUrl', 'https://testpilot-64v5.onrender.com');
                const gitContext = yield this._collectGitContext(workspacePath);
                // Upload for analysis
                const form = new FormData();
                form.append('file', content, 'repo.zip');
                form.append('git_log', gitContext.gitLog);
                form.append('git_diff', gitContext.gitDiff);
                const response = yield fetch(`${backendUrl}/api/v1/ide/review_repo_async`, {
                    method: 'POST',
                    body: form,
                    headers: form.getHeaders()
                });
                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.statusText}`);
                }
                const { job_id } = yield response.json();
                this._activeJobId = job_id;
                onUpdate({ status: 'running', findings: [], fixes: [], logs: ['Analysis started...', `Job ID: ${job_id}`] });
                // Start polling
                this._startPolling(backendUrl, onUpdate);
            }
            catch (error) {
                this._outputChannel.appendLine(`[SecurityAnalyzer] Error: ${error}`);
                onUpdate({ status: 'failed', findings: [], fixes: [], logs: [], error: error.message || String(error) });
            }
        });
    }
    _startPolling(backendUrl, onUpdate) {
        if (this._pollingInterval)
            clearInterval(this._pollingInterval);
        this._pollingInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this._activeJobId) {
                this._stopPolling();
                return;
            }
            try {
                const statusUrl = `${backendUrl}/api/v1/ide/job_status/${this._activeJobId}`;
                const response = yield fetch(statusUrl);
                if (response.ok) {
                    const data = yield response.json();
                    if (data.status === 'completed') {
                        this._stopPolling();
                        // Parse findings and fixes
                        const findings = (((_a = data.result) === null || _a === void 0 ? void 0 : _a.sonar_data) || []).map((item) => ({
                            filename: item.file || 'unknown',
                            line: item.line || 1,
                            severity: this._mapSeverity(item.severity),
                            message: item.message || '',
                            rule: item.rule || ''
                        }));
                        const fixes = (((_b = data.result) === null || _b === void 0 ? void 0 : _b.fixes) || []).map((fix) => ({
                            filename: fix.filename,
                            originalContent: fix.original_content || '',
                            newContent: fix.new_content || '',
                            unifiedDiff: fix.unified_diff || ''
                        }));
                        onUpdate({
                            status: 'completed',
                            findings,
                            fixes,
                            logs: data.logs || []
                        });
                    }
                    else if (data.status === 'failed') {
                        this._stopPolling();
                        onUpdate({
                            status: 'failed',
                            findings: [],
                            fixes: [],
                            logs: data.logs || [],
                            error: data.error || 'Analysis failed'
                        });
                    }
                    else {
                        // Still running
                        onUpdate({
                            status: 'running',
                            findings: [],
                            fixes: [],
                            logs: data.logs || []
                        });
                    }
                }
            }
            catch (err) {
                this._outputChannel.appendLine(`[SecurityAnalyzer] Polling error: ${err}`);
            }
        }), 2000);
    }
    _stopPolling() {
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = null;
        }
        this._activeJobId = null;
    }
    cancelAnalysis() {
        this._stopPolling();
    }
    startContextBuild(onProgress) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!workspacePath) {
                onProgress({ state: 'failed', percentage: 0, detail: 'No workspace open' });
                return;
            }
            onProgress({ state: 'running', percentage: 5, detail: 'Preparing workspace package' });
            try {
                const zip = new JSZip();
                yield this._addFolderToZip(zip, workspacePath, workspacePath);
                const content = yield zip.generateAsync({ type: 'nodebuffer' });
                const gitContext = yield this._collectGitContext(workspacePath);
                const config = vscode.workspace.getConfiguration('testpilot');
                const backendUrl = config.get('backendUrl', 'https://testpilot-64v5.onrender.com');
                const form = new FormData();
                form.append('file', content, 'repo.zip');
                form.append('git_diff', gitContext.gitDiff);
                const submitResponse = yield fetch(`${backendUrl}/api/v1/ide/analyze_unified`, {
                    method: 'POST',
                    body: form,
                    headers: form.getHeaders()
                });
                if (!submitResponse.ok) {
                    throw new Error(`Context build upload failed: ${submitResponse.status} ${submitResponse.statusText}`);
                }
                const { job_id } = yield submitResponse.json();
                onProgress({ state: 'running', percentage: 10, detail: `Context job started (${job_id})` });
                let finished = false;
                while (!finished) {
                    yield new Promise(resolve => setTimeout(resolve, 2000));
                    const statusResponse = yield fetch(`${backendUrl}/api/v1/ide/job_status/${job_id}`);
                    if (!statusResponse.ok) {
                        throw new Error(`Context status failed: ${statusResponse.status} ${statusResponse.statusText}`);
                    }
                    const statusData = yield statusResponse.json();
                    const status = statusData.status || 'pending';
                    const progress = statusData.progress || {};
                    const pct = Number(progress.percentage || 0);
                    const currentFile = progress.current_file || '';
                    if (status === 'completed') {
                        onProgress({ state: 'completed', percentage: 100, detail: 'Context graph and embeddings are ready' });
                        finished = true;
                    }
                    else if (status === 'failed') {
                        const err = ((_c = statusData.result) === null || _c === void 0 ? void 0 : _c.error) || statusData.error || 'Context build failed';
                        onProgress({ state: 'failed', percentage: Math.max(0, pct), detail: String(err) });
                        finished = true;
                    }
                    else {
                        const detail = currentFile ? `Processing ${currentFile}` : 'Building context graph and embeddings';
                        onProgress({ state: 'running', percentage: Math.max(10, pct), detail });
                    }
                }
            }
            catch (error) {
                this._outputChannel.appendLine(`[SecurityAnalyzer] Context build error: ${error}`);
                onProgress({ state: 'failed', percentage: 0, detail: (error === null || error === void 0 ? void 0 : error.message) || String(error) });
            }
        });
    }
    applyFix(fix) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!workspacePath)
                return;
            const filePath = path.join(workspacePath, fix.filename);
            yield this._stagingManager.stageFile(filePath, fix.newContent, true);
        });
    }
    acceptFix(fix) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!workspacePath)
                return;
            const filePath = path.join(workspacePath, fix.filename);
            if (!this._stagingManager.isStaged(filePath)) {
                yield this.applyFix(fix);
            }
            yield this._stagingManager.acceptChange(filePath);
        });
    }
    rejectFix(fix) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const workspacePath = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
            if (!workspacePath)
                return;
            const filePath = path.join(workspacePath, fix.filename);
            if (this._stagingManager.isStaged(filePath)) {
                yield this._stagingManager.rejectChange(filePath);
            }
        });
    }
    _mapSeverity(severity) {
        const s = (severity || '').toLowerCase();
        if (s.includes('critical') || s.includes('blocker'))
            return 'critical';
        if (s.includes('high') || s.includes('major'))
            return 'high';
        if (s.includes('medium') || s.includes('minor'))
            return 'medium';
        if (s.includes('low'))
            return 'low';
        return 'info';
    }
    _collectGitContext(workspacePath) {
        return __awaiter(this, void 0, void 0, function* () {
            // Use the same Git helper strategy used by commit list/review paths.
            const validation = yield gitHelper_1.gitHelper.getValidationContext(workspacePath);
            const history = yield gitHelper_1.gitHelper.getLog(workspacePath, 50);
            let gitDiff = (validation.diff || '').trim();
            if (!gitDiff) {
                const recent = yield gitHelper_1.gitHelper.getRecentCommits(workspacePath, 1);
                if (recent.length > 0) {
                    gitDiff = yield gitHelper_1.gitHelper.getCommitDiff(workspacePath, recent[0].sha);
                }
            }
            let gitLog = (history || '').trim();
            if (!gitLog && validation.commits.length > 0) {
                gitLog = `Range: ${validation.range}\n` + validation.commits.join('\n');
            }
            return { gitLog: gitLog || '', gitDiff: gitDiff || '' };
        });
    }
    _addFolderToZip(zip, folderPath, rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const excludeDirs = ['.git', 'node_modules', 'dist', 'out', '__pycache__', '.vscode', '.next', 'build', 'coverage', '.checkpoints', 'target'];
            const excludeExtensions = ['.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz'];
            const entries = yield fs.promises.readdir(folderPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(folderPath, entry.name);
                const relPath = path.relative(rootPath, fullPath);
                if (entry.isDirectory()) {
                    if (excludeDirs.includes(entry.name))
                        continue;
                    yield this._addFolderToZip(zip, fullPath, rootPath);
                }
                else {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (excludeExtensions.includes(ext))
                        continue;
                    try {
                        const content = yield fs.promises.readFile(fullPath);
                        zip.file(relPath, content);
                    }
                    catch (e) {
                        // Skip files that can't be read
                    }
                }
            }
        });
    }
    dispose() {
        this._stopPolling();
    }
}
exports.SecurityAnalyzer = SecurityAnalyzer;
//# sourceMappingURL=securityAnalyzer.js.map