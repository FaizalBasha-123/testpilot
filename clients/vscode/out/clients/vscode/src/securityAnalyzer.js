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
                const backendUrl = config.get('backendUrl', 'http://localhost:8001');
                // Upload for analysis
                const form = new FormData();
                form.append('file', content, 'repo.zip');
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
            yield this._stagingManager.rejectChange(filePath);
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