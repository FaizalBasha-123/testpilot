import * as vscode from 'vscode';
import { CommitTracker, TrackedCommit } from './commitTracker';
import { SecurityAnalyzer, AnalysisResult, FixProposal } from './securityAnalyzer';
import { StagingManager } from '../../../adapters/vscode/stagingManager';
import { gitHelper } from '../../../adapters/vscode/gitHelper';
import * as path from 'path';

const fetch: any = require('node-fetch');

type ViewState = 'commitList' | 'commitDetail' | 'securityWelcome' | 'securityRunning' | 'securityResults';
type ToggleState = 'commits' | 'security';

interface CommitReviewIssue {
    severity: string;
    description: string;
}

interface CommitReviewFix {
    filename: string;
    new_content?: string;
    newContent?: string;
    unified_diff?: string;
    unifiedDiff?: string;
}

interface CommitReviewData {
    summary?: string;
    score?: number;
    issues?: CommitReviewIssue[];
    fixes?: CommitReviewFix[];
    logs?: string[];
    stage?: 'setting_up' | 'analyzing' | 'reviewing' | 'completed';
}

// SVG Icons (inline, enterprise-grade)
const SVG = {
    check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`,
    circle: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
    spinner: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="spin"><path d="M8 0a8 8 0 0 1 8 8h-1.5a6.5 6.5 0 0 0-6.5-6.5V0z"/></svg>`,
    file: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 1.5v13h9v-9l-4-4h-5zm1 1h3.5v3.5h3.5v7.5h-7v-11zm4.5.7l1.8 1.8h-1.8v-1.8z"/></svg>`,
    chevronRight: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4"/></svg>`,
    chevronDown: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4"/></svg>`,
    shield: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`,
    play: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>`,
    back: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L4 8l6 5V3z"/></svg>`,
    critical: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#dc3545"><circle cx="8" cy="8" r="7"/></svg>`,
    high: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#fd7e14"><circle cx="8" cy="8" r="7"/></svg>`,
    medium: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#ffc107"><circle cx="8" cy="8" r="7"/></svg>`,
    low: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#28a745"><circle cx="8" cy="8" r="7"/></svg>`,
    info: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#17a2b8"><circle cx="8" cy="8" r="7"/></svg>`,
    accept: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#28a745"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`,
    reject: `<svg width="14" height="14" viewBox="0 0 16 16" fill="#dc3545"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>`
};

/**
 * Main sidebar provider with toggle and dynamic views
 */
export class TestPilotSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewId = 'testpilot.sidebarView';

    private _view?: vscode.WebviewView;
    private _currentView: ViewState = 'commitList';
    private _selectedToggle: ToggleState = 'commits';
    private _selectedCommit?: TrackedCommit;
    private _commitTracker: CommitTracker;
    private _securityAnalyzer: SecurityAnalyzer;
    private _stagingManager: StagingManager;
    private _extensionUri: vscode.Uri;
    private _analysisResult?: AnalysisResult;
    private _collapsedSections: Set<string> = new Set();
    private _securityOutputChannel: vscode.OutputChannel;
    private _commitOutputChannel: vscode.OutputChannel;
    private _contextStatus: { state: 'idle' | 'running' | 'completed' | 'failed'; percentage: number; detail: string } = {
        state: 'idle',
        percentage: 0,
        detail: 'Waiting for workspace context sync'
    };
    private _commitFixStates: Map<string, 'pending' | 'accepted' | 'rejected'> = new Map();

    constructor(
        extensionUri: vscode.Uri,
        commitTracker: CommitTracker,
        stagingManager: StagingManager
    ) {
        this._extensionUri = extensionUri;
        this._commitTracker = commitTracker;
        this._stagingManager = stagingManager;
        this._securityAnalyzer = new SecurityAnalyzer(stagingManager);
        this._securityOutputChannel = vscode.window.createOutputChannel('TestPilot Security');
        this._commitOutputChannel = vscode.window.createOutputChannel('TestPilot Commit Review');

        this._commitTracker.onCommitsChanged(() => {
            this._updateView();
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'toggleChange':
                    this._selectedToggle = message.value;
                    if (message.value === 'commits') {
                        this._currentView = 'commitList';
                    } else {
                        this._currentView = this._analysisResult?.status === 'completed' ? 'securityResults' : 'securityWelcome';
                    }
                    this._updateView();
                    break;

                case 'selectCommit':
                    const commit = this._commitTracker.getCommit(message.sha);
                    if (commit) {
                        this._selectedCommit = commit;
                        this._currentView = 'commitDetail';
                        this._updateView();
                        if (commit.status === 'pending') {
                            this._commitOutputChannel.appendLine(`[Commit Review] Selected commit ${commit.shortSha}. Starting review...`);
                            this._analyzeCommit(commit, true);
                        }
                    }
                    break;
                case 'reviewCommit':
                    if (this._selectedCommit) {
                        this._analyzeCommit(this._selectedCommit, true);
                    }
                    break;

                case 'goBack':
                    if (this._selectedToggle === 'commits') {
                        this._currentView = 'commitList';
                        this._selectedCommit = undefined;
                    } else {
                        this._currentView = 'securityWelcome';
                    }
                    this._updateView();
                    break;

                case 'toggleSection':
                    if (this._collapsedSections.has(message.section)) {
                        this._collapsedSections.delete(message.section);
                    } else {
                        this._collapsedSections.add(message.section);
                    }
                    this._updateView();
                    break;
                case 'expandCommitFix':
                    const commitFixKey = `commit-fix-${message.filename}`;
                    if (this._collapsedSections.has(commitFixKey)) {
                        this._collapsedSections.delete(commitFixKey);
                    } else {
                        this._collapsedSections.add(commitFixKey);
                    }
                    await this._showCommitFixDiff(message.filename);
                    this._updateView();
                    break;

                case 'startSecurityAnalysis':
                    this._currentView = 'securityRunning';
                    this._updateView();
                    this._securityAnalyzer.startAnalysis(async (result) => {
                        this._analysisResult = result;
                        if (result.status === 'completed') {
                            await this._autoApplySecurityFixes(result.fixes || []);
                        }
                        if (result.status === 'completed' || result.status === 'failed') {
                            this._currentView = 'securityResults';
                        }
                        this._updateView();
                    });
                    break;

                case 'acceptFix':
                    // This case is now handled by acceptSecurityFix for consistency
                    const fixToAccept = this._analysisResult?.fixes.find(f => f.filename === message.filename);
                    if (fixToAccept) {
                        await this._acceptSecurityFix(message.filename);
                    }
                    break;

                case 'rejectFix':
                    const fixToReject = this._analysisResult?.fixes.find(f => f.filename === message.filename);
                    if (fixToReject) {
                        await this._securityAnalyzer.rejectFix(fixToReject);
                        this._analysisResult = {
                            ...this._analysisResult!,
                            fixes: this._analysisResult!.fixes.filter(f => f.filename !== message.filename)
                        };
                        vscode.window.showInformationMessage(`Rejected fix for ${message.filename}`);
                        this._updateView();
                    }
                    break;

                case 'expandSecurityFix':
                    const fixKey = `fix-${message.filename}`;
                    if (this._collapsedSections.has(fixKey)) {
                        this._collapsedSections.delete(fixKey);
                    } else {
                        this._collapsedSections.add(fixKey);
                    }
                    await this._showSecurityFixDiff(message.filename);
                    this._updateView();
                    break;

                case 'acceptSecurityFix':
                    await this._acceptSecurityFix(message.filename);
                    break;

                case 'rejectSecurityFix':
                    await this._rejectSecurityFix(message.filename);
                    break;

                case 'acceptCommitFix':
                    await this._acceptCommitFix(message.filename);
                    break;

                case 'rejectCommitFix':
                    await this._rejectCommitFix(message.filename);
                    break;

                case 'openFile':
                    this._openFile(message.file);
                    break;
            }
        });

        this._updateView();
    }

    public startBackgroundContextBuild(): void {
        this._contextStatus = {
            state: 'running',
            percentage: 0,
            detail: 'Scheduling context preparation job'
        };
        this._updateView();

        this._securityAnalyzer.startContextBuild((progress) => {
            const nextState =
                progress.state === 'completed'
                    ? 'completed'
                    : progress.state === 'failed'
                        ? 'failed'
                        : 'running';

            this._contextStatus = {
                state: nextState,
                percentage: Math.min(100, Math.max(0, progress.percentage)),
                detail: progress.detail
            };
            this._updateView();
        });
    }

    private _updateView() {
        if (!this._view) return;

        if (this._selectedCommit) {
            const refreshed = this._commitTracker.getCommit(this._selectedCommit.sha);
            if (refreshed) {
                this._selectedCommit = refreshed;
            }
        }

        let content = '';
        switch (this._currentView) {
            case 'commitList':
                content = this._getCommitListHtml();
                break;
            case 'commitDetail':
                content = this._getCommitDetailHtml();
                break;
            case 'securityWelcome':
                content = this._getSecurityWelcomeHtml();
                break;
            case 'securityRunning':
                content = this._getSecurityRunningHtml();
                break;
            case 'securityResults':
                content = this._getSecurityResultsHtml();
                break;
        }

        this._view.webview.html = this._wrapHtml(content);
    }

    private async _analyzeCommit(commit: TrackedCommit, forceReview: boolean = false) {
        if (!this._view) return;

        await this._commitTracker.updateCommitStatus(commit.sha, 'analyzing');
        this._updateView();

        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspacePath) return;

            const diff = await gitHelper.getCommitDiff(workspacePath, commit.sha);
            const gitLog = await gitHelper.getCommitLog(workspacePath, commit.sha);

            const safeLog = gitLog && gitLog.trim().length > 0
                ? gitLog
                : `${commit.sha}\n${commit.message}`;
            const safeDiff = diff && diff.trim().length > 0 ? diff : '';

            this._commitOutputChannel.appendLine(`[Commit Review] git_log chars=${safeLog.length} git_diff chars=${safeDiff.length}`);

            const config = vscode.workspace.getConfiguration('testpilot');
            const backendUrl = config.get<string>('backendUrl', 'https://testpilot-64v5.onrender.com');

            // Commit review uses the same real backend pipeline as security analysis.
            // This intentionally avoids local mock heuristics and always requests AI-core analysis.
            const zip = require('jszip');
            const archive = new zip();
            await this._addCommitFilesToZip(archive, workspacePath, commit.sha);
            const content = await archive.generateAsync({ type: 'nodebuffer' });

            const form = new (require('form-data'))();
            form.append('file', content, 'repo.zip');
            form.append('git_log', safeLog);
            form.append('git_diff', safeDiff);
            form.append('force_review', forceReview ? 'true' : 'false');

            const response = await fetch(`${backendUrl}/api/v1/ide/review_repo_async`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Review submit failed: ${response.status} ${response.statusText}`);
            }

            const submitted = await response.json();
            const jobId = submitted.job_id as string | undefined;
            if (!jobId) {
                throw new Error('Commit review response missing job_id');
            }

            await this._commitTracker.updateCommitStatus(commit.sha, 'analyzing', {
                logs: ['Commit review submitted. Waiting for backend updates...'],
                stage: 'setting_up'
            });

            let reviewData: CommitReviewData | undefined;
            let lastLogLine = '';
            while (!reviewData) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const statusResponse = await fetch(`${backendUrl}/api/v1/ide/job_status/${jobId}`);
                if (!statusResponse.ok) {
                    throw new Error(`Review status failed: ${statusResponse.status} ${statusResponse.statusText}`);
                }

                const statusData = await statusResponse.json();
                if (statusData.status === 'completed') {
                    const result = statusData.result || {};
                    const fixes = Array.isArray(result.fixes) ? result.fixes : [];
                    const issues = Array.isArray(result.sonar_data)
                        ? result.sonar_data.map((item: any) => ({
                            severity: (item.severity || 'info').toString().toLowerCase(),
                            description: item.message || ''
                        }))
                        : [];

                    reviewData = {
                        summary: result.review || 'Review completed',
                        score: issues.length === 0 ? 100 : Math.max(30, 100 - (issues.length * 10)),
                        issues,
                        fixes,
                        logs: Array.isArray(statusData.logs)
                            ? statusData.logs
                            : Array.isArray(result.logs)
                                ? result.logs
                                : [],
                        stage: 'completed'
                    };

                    await this._autoApplyCommitFixes(reviewData.fixes || []);
                } else if (statusData.status === 'failed') {
                    throw new Error(statusData.error || statusData.result?.error || 'Commit review failed');
                } else {
                    const logs = Array.isArray(statusData.logs)
                        ? statusData.logs
                        : Array.isArray(statusData.result?.logs)
                            ? statusData.result.logs
                            : [];
                    const progress = statusData.progress || {};
                    const fallbackLogs: string[] = [];
                    if (progress.current_file) {
                        const processed = typeof progress.processed === 'number' ? progress.processed : 0;
                        const total = typeof progress.total === 'number' ? progress.total : 0;
                        fallbackLogs.push(`Processing ${progress.current_file} (${processed}/${total})`);
                    }
                    if (!fallbackLogs.length && statusData.status) {
                        fallbackLogs.push(`Status: ${statusData.status}`);
                    }
                    const mergedLogs = logs.length > 0 ? logs : fallbackLogs;
                    const stage = this._deriveCommitStage(logs);
                    const last = mergedLogs.length > 0 ? mergedLogs[mergedLogs.length - 1] : '';
                    if (last && last !== lastLogLine) {
                        this._commitOutputChannel.appendLine(`[Commit Review] ${last}`);
                        lastLogLine = last;
                    }

                    const existing = this._commitTracker.getCommit(commit.sha);
                    const prevData = (existing?.reviewData || {}) as CommitReviewData;
                    await this._commitTracker.updateCommitStatus(commit.sha, 'analyzing', {
                        ...prevData,
                        logs: mergedLogs,
                        stage
                    });
                }
            }

            await this._commitTracker.updateCommitStatus(commit.sha, 'reviewed', reviewData);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            await this._commitTracker.updateCommitStatus(commit.sha, 'reviewed', {
                summary: `Review failed: ${errorMessage}`,
                score: 0,
                issues: [{ severity: 'critical', description: errorMessage }],
                fixes: []
            });
        }

        this._selectedCommit = this._commitTracker.getCommit(commit.sha);
        this._updateView();
    }

    private async _openFile(filename: string) {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = vscode.Uri.file(require('path').join(workspacePath, filename));
        try {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        } catch (e) {
            vscode.window.showErrorMessage(`Could not open: ${filename}`);
        }
    }

    private _getCommitReviewData(commit: TrackedCommit): CommitReviewData {
        return (commit.reviewData || {}) as CommitReviewData;
    }

    private async _acceptCommitFix(filename: string): Promise<void> {
        if (!this._selectedCommit) return;

        const data = this._getCommitReviewData(this._selectedCommit);
        const fix = (data.fixes || []).find(f => f.filename === filename);
        if (!fix) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = path.join(workspacePath, filename);
        this._stagingManager.finalizeChange(filePath);
        this._commitFixStates.set(filename, 'accepted');
        this._commitOutputChannel.appendLine(`[Commit Review] Accepted fix: ${filename}`);
        this._updateView();
    }

    private async _rejectCommitFix(filename: string): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspacePath) {
            const filePath = path.join(workspacePath, filename);
            if (this._stagingManager.isStaged(filePath)) {
                await this._stagingManager.rejectChange(filePath);
            }
        }
        this._commitFixStates.set(filename, 'rejected');
        this._commitOutputChannel.appendLine(`[Commit Review] Rejected fix: ${filename}`);
        this._updateView();
    }

    private async _showCommitFixDiff(filename: string): Promise<void> {
        if (!this._selectedCommit) return;

        const data = this._getCommitReviewData(this._selectedCommit);
        const fix = (data.fixes || []).find(f => f.filename === filename);
        if (!fix) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const newContent = fix.new_content || fix.newContent;
        if (!newContent) return;

        const filePath = path.join(workspacePath, filename);

        try {
            await this._stagingManager.stageFile(filePath, newContent, true);
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to preview fix: ${String(e)}`);
        }
    }

    private async _showSecurityFixDiff(filename: string): Promise<void> {
        if (!this._analysisResult) return;

        const fix = this._analysisResult.fixes.find(f => f.filename === filename);
        if (!fix) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = path.join(workspacePath, fix.filename);

        try {
            // Show diff using the staged original (kept until accept/reject).
            await this._stagingManager.stageFile(filePath, fix.newContent, true);
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to preview fix: ${String(e)}`);
        }
    }

    private async _acceptSecurityFix(filename: string): Promise<void> {
        if (!this._analysisResult) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        try {
            const filePath = path.join(workspacePath, filename);
            this._stagingManager.finalizeChange(filePath);
            // Remove from the fixes list
            this._analysisResult.fixes = this._analysisResult.fixes.filter(f => f.filename !== filename);
            vscode.window.showInformationMessage(`✅ Accepted fix for ${filename}`);
            this._securityOutputChannel.appendLine(`[Security] Accepted fix: ${filename}`);
            this._analysisResult = undefined;
            this._currentView = 'securityWelcome';
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to apply fix: ${String(e)}`);
        }

        this._updateView();
    }

    private async _rejectSecurityFix(filename: string): Promise<void> {
        if (!this._analysisResult) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = path.join(workspacePath, filename);

        try {
            if (this._stagingManager.isStaged(filePath)) {
                await this._stagingManager.rejectChange(filePath);
            }
            // Remove from the fixes list
            this._analysisResult.fixes = this._analysisResult.fixes.filter(f => f.filename !== filename);
            vscode.window.showInformationMessage(`❌ Rejected fix for ${filename}`);
            this._securityOutputChannel.appendLine(`[Security] Rejected fix: ${filename}`);
            this._analysisResult = undefined;
            this._currentView = 'securityWelcome';
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to reject fix: ${String(e)}`);
        }

        this._updateView();
    }

    private async _autoApplySecurityFixes(fixes: FixProposal[]): Promise<void> {
        if (fixes.length === 0) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        this._securityOutputChannel.appendLine(`[Security] Auto-applying ${fixes.length} fix(es) to workspace.`);

        for (const fix of fixes) {
            const filePath = path.join(workspacePath, fix.filename);
            try {
                await this._stagingManager.stageFile(filePath, fix.newContent, false);
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                await doc.save();
                this._securityOutputChannel.appendLine(`[Security] Applied fix: ${fix.filename}`);
            } catch (e) {
                this._securityOutputChannel.appendLine(`[Security] Failed to apply ${fix.filename}: ${String(e)}`);
            }
        }
    }

    private async _autoApplyCommitFixes(fixes: CommitReviewFix[]): Promise<void> {
        if (fixes.length === 0) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        this._commitOutputChannel.appendLine(`[Commit Review] Auto-applying ${fixes.length} fix(es) to workspace.`);

        for (const fix of fixes) {
            const filePath = path.join(workspacePath, fix.filename);
            const newContent = fix.new_content || fix.newContent;
            if (!newContent) {
                this._commitOutputChannel.appendLine(`[Commit Review] Missing content for ${fix.filename}`);
                continue;
            }
            try {
                await this._stagingManager.stageFile(filePath, newContent, false);
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                await doc.save();
                this._commitOutputChannel.appendLine(`[Commit Review] Applied fix: ${fix.filename}`);
            } catch (e) {
                this._commitOutputChannel.appendLine(`[Commit Review] Failed to apply ${fix.filename}: ${String(e)}`);
            }
        }
    }

    private _deriveCommitStage(logs: string[]): CommitReviewData['stage'] {
        if (!logs || logs.length === 0) return 'analyzing';
        const last = logs[logs.length - 1].toLowerCase();
        if (last.includes('review')) return 'reviewing';
        if (last.includes('llm')) return 'reviewing';
        if (last.includes('sonar') || last.includes('scan') || last.includes('analy')) return 'analyzing';
        return 'analyzing';
    }

    private async _addCommitFilesToZip(zip: any, workspacePath: string, sha: string): Promise<void> {
        const files = await gitHelper.getCommitFiles(workspacePath, sha);
        for (const file of files) {
            const content = await gitHelper.getCommitFileContent(workspacePath, sha, file);
            if (content === null) continue;
            zip.file(file, content);
        }
    }

    private async _addFolderToZip(zip: any, folderPath: string, rootPath: string): Promise<void> {
        const fs = require('fs');
        const excludeDirs = ['.git', 'node_modules', 'dist', 'out', '__pycache__', '.vscode', '.next', 'build', 'coverage', '.checkpoints', 'target'];
        const excludeExtensions = ['.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz'];

        const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const relPath = path.relative(rootPath, fullPath);

            if (entry.isDirectory()) {
                if (excludeDirs.includes(entry.name)) continue;
                await this._addFolderToZip(zip, fullPath, rootPath);
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            if (excludeExtensions.includes(ext)) continue;

            try {
                const content = await fs.promises.readFile(fullPath);
                zip.file(relPath, content);
            } catch {
                // Skip unreadable files.
            }
        }
    }

    // ========== HTML GENERATORS ==========

    private _getCommitListHtml(): string {
        const commits = this._commitTracker.getTrackedCommits();
        const reviewedCommits = this._commitTracker.getReviewedCommits();

        let commitsHtml = '';
        if (commits.length === 0) {
            commitsHtml = '<div class="empty-state">No commits detected yet.<br>Make a commit to see it here.</div>';
        } else {
            for (const commit of commits.slice(0, 10)) {
                const icon = commit.status === 'reviewed' ? SVG.check : commit.status === 'analyzing' ? SVG.spinner : SVG.circle;
                const statusClass = commit.status;
                commitsHtml += `
                    <div class="commit-row ${statusClass}" onclick="selectCommit('${commit.sha}')">
                        <div class="commit-icon">${icon}</div>
                        <div class="commit-info">
                            <div class="commit-message">${this._escapeHtml(commit.message.substring(0, 50))}</div>
                            <div class="commit-meta">${commit.shortSha} · ${commit.date}</div>
                        </div>
                        <div class="commit-arrow">${SVG.chevronRight}</div>
                    </div>
                `;
            }
        }

        return `
            <div class="section-header">
                <span class="section-icon">${SVG.circle}</span>
                <span>REVIEWS</span>
            </div>
            <div class="commit-list">
                ${commitsHtml}
            </div>
            ${reviewedCommits.length > 0 ? `
                <div class="section-header collapsible" onclick="toggleSection('previous')">
                    <span>${this._collapsedSections.has('previous') ? SVG.chevronRight : SVG.chevronDown} PREVIOUS REVIEWS</span>
                    <span class="badge">${reviewedCommits.length}</span>
                </div>
            ` : ''}
        `;
    }

    private _getCommitDetailHtml(): string {
        if (!this._selectedCommit) return '<div>No commit selected</div>';

        const commit = this._selectedCommit;
        const isAnalyzing = commit.status === 'analyzing';
        const isReviewed = commit.status === 'reviewed';
        const filesCollapsed = this._collapsedSections.has('files');
        const commitData = this._getCommitReviewData(commit);
        const stage = commitData.stage || 'setting_up';

        const steps = [
            { label: 'Setting up', done: true },
            { label: 'Analyzing changes', done: isReviewed, active: isAnalyzing && stage !== 'reviewing' },
            { label: 'Reviewing files', done: isReviewed, active: isAnalyzing && stage === 'reviewing' }
        ];

        let stepsHtml = steps.map(step => {
            const icon = step.done ? SVG.check : step.active ? SVG.spinner : SVG.circle;
            const cls = step.done ? 'done' : step.active ? 'active' : '';
            return `<div class="step ${cls}"><span class="step-icon">${icon}</span> ${step.label}</div>`;
        }).join('');

        let filesHtml = '';
        if (!filesCollapsed) {
            filesHtml = commit.files.map(f =>
                `<div class="file-row" onclick="openFile('${f}')">
                    <span class="file-icon">${SVG.file}</span>
                    <span class="file-name">${f}</span>
                </div>`
            ).join('');
        }

        let reviewsHtml = '';
        if (isReviewed && commit.reviewData) {
            const data = commitData;
            const score = data.score ?? 0;
            const scoreIcon = score >= 80 ? SVG.check : score >= 60 ? SVG.medium : SVG.critical;
            reviewsHtml = `
                <div class="review-summary">
                    <div class="score">${scoreIcon} Score: ${score}/100</div>
                    <div class="summary-text">${data.summary || ''}</div>
                    <div class="review-actions">
                        <button class="primary-btn" onclick="reviewCommit()">${SVG.play} Review Commit</button>
                    </div>
                </div>
            `;
            if (data.issues && data.issues.length > 0) {
                reviewsHtml += '<div class="issues-list">';
                for (const issue of data.issues) {
                    const badge = (SVG as any)[issue.severity] || SVG.info;
                    reviewsHtml += `<div class="issue-row">${badge} ${issue.description}</div>`;
                }
                reviewsHtml += '</div>';
            }

            const pendingFixes = (data.fixes || []).filter(f => this._commitFixStates.get(f.filename) !== 'accepted' && this._commitFixStates.get(f.filename) !== 'rejected');
            if (pendingFixes.length > 0) {
                reviewsHtml += `
                    <div class="section-header" style="padding-left:0;padding-right:0;border:none;">
                        <span>PROPOSED FIXES</span>
                        <span class="badge">${pendingFixes.length}</span>
                    </div>
                `;
                for (const fix of pendingFixes) {
                    const isExpanded = this._collapsedSections.has(`commit-fix-${fix.filename}`) === false;
                    const unifiedDiff = fix.unifiedDiff || fix.unified_diff || '';
                    const diffHtml = this._formatDiffHtml(unifiedDiff);
                    reviewsHtml += `
                        <div class="fix-card">
                            <div class="fix-header" onclick="expandCommitFix('${fix.filename.replace(/'/g, "\\'")}')"
                                 style="cursor: pointer; display: flex; align-items: center; padding: 10px 14px; user-select: none;">
                                <span style="color: var(--vscode-descriptionForeground, #888); margin-right: 8px;">
                                    ${isExpanded ? SVG.chevronDown : SVG.chevronRight}
                                </span>
                                <span>${SVG.file} ${fix.filename}</span>
                            </div>
                            ${isExpanded ? `
                                <div class="fix-diff" style="background: var(--vscode-editor-background, #1e1e1e); border-top: 1px solid var(--vscode-panel-border, #2a2a2a); max-height: 300px; overflow: auto;">
                                    ${diffHtml}
                                </div>
                            ` : ''}
                            <div class="fix-actions">
                                <button class="action-btn accept" onclick="acceptCommitFix('${fix.filename.replace(/'/g, "\\'")}')"
                                        style="flex: 1; margin: 10px 10px 10px 14px;">${SVG.accept} Accept</button>
                                <button class="action-btn reject" onclick="rejectCommitFix('${fix.filename.replace(/'/g, "\\'")}')"
                                        style="flex: 1; margin: 10px 14px 10px 0;">${SVG.reject} Reject</button>
                            </div>
                        </div>
                    `;
                }
            }
        }

        let progressHtml = '';
        if (isAnalyzing) {
            const logs = (commitData.logs || []).slice(-6);
            const logsHtml = logs.length > 0
                ? logs.map(line => `<div class="log-line">${this._escapeHtml(line)}</div>`).join('')
                : '<div class="log-line">Waiting for backend updates...</div>';
            progressHtml = `
                <div class="section-header" style="padding-left:0;padding-right:0;border:none;">
                    <span>LIVE STATUS</span>
                </div>
                <div class="logs-container">
                    ${logsHtml}
                </div>
            `;
        }

        return `
            <div class="detail-header">
                <button class="back-btn" onclick="goBack()">${SVG.back}</button>
                <div class="detail-title">${this._escapeHtml(commit.message.substring(0, 40))}...</div>
            </div>
            <div class="steps-section">
                ${stepsHtml}
            </div>
            ${progressHtml}
            <div class="section-header collapsible" onclick="toggleSection('files')">
                <span>${filesCollapsed ? SVG.chevronRight : SVG.chevronDown} FILES</span>
                <span class="badge">${commit.files.length}</span>
            </div>
            <div class="files-list ${filesCollapsed ? 'collapsed' : ''}">
                ${filesHtml || '<div class="empty-state">No files changed</div>'}
            </div>
            ${isReviewed ? `
                <div class="section-header">
                    <span>REVIEW RESULTS</span>
                </div>
                <div class="reviews-section">
                    ${reviewsHtml}
                </div>
            ` : ''}
        `;
    }

    private _getSecurityWelcomeHtml(): string {
        return `
            <div class="security-welcome">
                <div class="welcome-icon">${SVG.shield}</div>
                <h2>Security Analysis</h2>
                <p>Scan your codebase for vulnerabilities using static analysis. Detected issues will be automatically fixed where possible.</p>
                <button class="primary-btn" onclick="startSecurityAnalysis()">
                    ${SVG.play} Start Analysis
                </button>
            </div>
        `;
    }

    private _getSecurityRunningHtml(): string {
        const logs = this._analysisResult?.logs || ['Starting analysis...'];
        const logsHtml = logs.slice(-5).map(l => `<div class="log-line">${this._escapeHtml(l)}</div>`).join('');

        return `
            <div class="security-running">
                <div class="running-icon">${SVG.spinner}</div>
                <h2>Analyzing...</h2>
                <div class="logs-container">
                    ${logsHtml}
                </div>
            </div>
        `;
    }

    private _getSecurityResultsHtml(): string {
        if (!this._analysisResult) return '<div>No results</div>';

        const { status, findings, fixes, error } = this._analysisResult;

        if (status === 'failed') {
            return `
                <div class="security-error">
                    <div class="error-icon">${SVG.critical}</div>
                    <h2>Analysis Failed</h2>
                    <p>${this._escapeHtml(error || 'Unknown error')}</p>
                    <button class="primary-btn" onclick="startSecurityAnalysis()">
                        ${SVG.play} Retry
                    </button>
                </div>
            `;
        }

        // Group findings by severity
        const bySeverity: Record<string, number> = {};
        for (const f of findings) {
            bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        }

        let summaryHtml = '<div class="severity-summary">';
        for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
            if (bySeverity[sev]) {
                summaryHtml += `<div class="sev-badge ${sev}">${(SVG as any)[sev]} ${bySeverity[sev]}</div>`;
            }
        }
        summaryHtml += '</div>';

        let fixesHtml = '';
        if (fixes.length > 0) {
            fixesHtml = '<div class="fixes-section">';
            for (const fix of fixes) {
                const isExpanded = this._collapsedSections.has(`fix-${fix.filename}`) === false; // Default expanded
                const diffHtml = this._formatDiffHtml(fix.unifiedDiff);
                fixesHtml += `
                    <div class="fix-card">
                        <div class="fix-header" onclick="expandSecurityFix('${fix.filename.replace(/'/g, "\\'")}')"
                             style="cursor: pointer; display: flex; align-items: center; padding: 10px 14px; user-select: none;">
                            <span style="color: var(--vscode-descriptionForeground, #888); margin-right: 8px;">
                                ${isExpanded ? SVG.chevronDown : SVG.chevronRight}
                            </span>
                            <span>${SVG.file} ${fix.filename}</span>
                        </div>
                        ${isExpanded ? `
                            <div class="fix-diff" style="background: var(--vscode-editor-background, #1e1e1e); border-top: 1px solid var(--vscode-panel-border, #2a2a2a); max-height: 300px; overflow: auto;">
                                ${diffHtml}
                            </div>
                        ` : ''}
                        <div class="fix-actions">
                            <button class="action-btn accept" onclick="acceptSecurityFix('${fix.filename.replace(/'/g, "\\'")}')"
                                    style="flex: 1; margin: 10px 10px 10px 14px;">${SVG.accept} Accept</button>
                            <button class="action-btn reject" onclick="rejectSecurityFix('${fix.filename.replace(/'/g, "\\'")}')"
                                    style="flex: 1; margin: 10px 14px 10px 0;">${SVG.reject} Reject</button>
                        </div>
                    </div>
                `;
            }
            fixesHtml += '</div>';
        }

        return `
            <div class="detail-header">
                <button class="back-btn" onclick="goBack()">${SVG.back}</button>
                <div class="detail-title">Security Results</div>
            </div>
            <div class="results-summary">
                <h3>${findings.length} Vulnerabilities Found</h3>
                ${summaryHtml}
            </div>
            ${fixes.length > 0 ? `
                <div class="section-header">
                    <span>PROPOSED FIXES</span>
                    <span class="badge">${fixes.length}</span>
                </div>
                ${fixesHtml}
            ` : '<div class="empty-state">No automatic fixes available</div>'}
        `;
    }

    private _formatDiffHtml(unifiedDiff: string): string {
        if (!unifiedDiff) return '<div style="padding: 14px; color: var(--vscode-descriptionForeground, #888);">No diff available</div>';

        const lines = unifiedDiff.split('\n');
        let html = '<div style="font-family: monospace; font-size: 12px; line-height: 1.4;">';

        for (const line of lines) {
            if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
                // Header lines
                html += `<div style="color: var(--vscode-gitDecoration-ignoredResourceForeground, #666); padding: 0 14px;">${this._escapeHtml(line)}</div>`;
            } else if (line.startsWith('+')) {
                // Added lines - green
                html += `<div style="background: rgba(76,175,80,0.15); color: #4caf50; padding: 0 14px;">${this._escapeHtml(line)}</div>`;
            } else if (line.startsWith('-')) {
                // Removed lines - red
                html += `<div style="background: rgba(220,53,69,0.15); color: #dc3545; padding: 0 14px;">${this._escapeHtml(line)}</div>`;
            } else {
                // Context lines
                html += `<div style="color: var(--vscode-foreground, #ccc); padding: 0 14px;">${this._escapeHtml(line)}</div>`;
            }
        }

        html += '</div>';
        return html;
    }

    private _escapeHtml(text: string): string {
        return text.replace(/[&<>"']/g, (m) => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return m;
            }
        });
    }

    private _getContextStatusText(): string {
        if (this._contextStatus.state === 'running') {
            return `Context sync ${this._contextStatus.percentage}%: ${this._contextStatus.detail}`;
        }
        if (this._contextStatus.state === 'completed') {
            return 'Context sync 100%: ready';
        }
        if (this._contextStatus.state === 'failed') {
            return `Context sync failed: ${this._contextStatus.detail}`;
        }
        return this._contextStatus.detail;
    }

    private _wrapHtml(content: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
            background: var(--vscode-sideBar-background, #1e1e1e);
            color: var(--vscode-foreground, #ccc);
            font-size: 13px;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .brand-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 14px 12px 6px;
        }
        .brand-title {
            font-size: 28px;
            line-height: 1.1;
            font-weight: 700;
            letter-spacing: 0.4px;
            margin-bottom: 6px;
        }
        .brand-status {
            width: 100%;
            text-align: right;
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #888);
            min-height: 14px;
        }

        /* Spinner animation */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        /* Toggle */
        .toggle-container {
            display: flex;
            background: var(--vscode-input-background, #2d2d2d);
            border-radius: 20px;
            padding: 3px;
            margin: 12px;
        }
        .toggle-btn {
            flex: 1;
            padding: 8px 12px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground, #888);
            border-radius: 17px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        .toggle-btn.active {
            background: var(--vscode-button-background, #0e639c);
            color: white;
        }

        /* Sections */
        .section-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 10px 14px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground, #888);
            border-bottom: 1px solid var(--vscode-panel-border, #333);
        }
        .section-header.collapsible { cursor: pointer; }
        .section-header.collapsible:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
        .section-icon { display: flex; align-items: center; }
        .badge {
            background: var(--vscode-badge-background, #4d4d4d);
            color: var(--vscode-badge-foreground, #fff);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: auto;
        }

        /* Commit List */
        .commit-list { flex: 1; overflow-y: auto; }
        .commit-row {
            display: flex;
            align-items: center;
            padding: 12px 14px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border, #2a2a2a);
            transition: background 0.15s;
        }
        .commit-row:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
        .commit-row.reviewed { opacity: 0.7; }
        .commit-icon {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-descriptionForeground, #888);
        }
        .commit-row.reviewed .commit-icon { color: #4caf50; }
        .commit-row.analyzing .commit-icon { color: #ff9800; }
        .commit-info { flex: 1; margin-left: 10px; }
        .commit-message { font-weight: 500; margin-bottom: 2px; }
        .commit-meta { font-size: 11px; color: var(--vscode-descriptionForeground, #888); }
        .commit-arrow { color: var(--vscode-descriptionForeground, #666); }

        /* Detail View */
        .detail-header {
            display: flex;
            align-items: center;
            padding: 12px 14px;
            border-bottom: 1px solid var(--vscode-panel-border, #333);
        }
        .back-btn {
            background: none;
            border: none;
            color: var(--vscode-foreground, #ccc);
            cursor: pointer;
            padding: 4px 8px;
            margin-right: 8px;
            display: flex;
            align-items: center;
        }
        .back-btn:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); border-radius: 4px; }
        .detail-title { font-weight: 600; flex: 1; }

        /* Steps */
        .steps-section { padding: 14px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
        .step {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
            color: var(--vscode-descriptionForeground, #888);
        }
        .step.done { color: var(--vscode-foreground, #ccc); }
        .step.active { color: #ff9800; }
        .step-icon { display: flex; align-items: center; }

        /* Files */
        .files-list { padding: 8px 0; }
        .files-list.collapsed { display: none; }
        .file-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            cursor: pointer;
        }
        .file-row:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
        .file-icon { display: flex; align-items: center; }
        .file-name { font-size: 13px; }

        /* Reviews */
        .reviews-section { padding: 14px; }
        .review-summary { margin-bottom: 12px; }
        .score { display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .summary-text { color: var(--vscode-descriptionForeground, #888); }
        .review-actions { margin-top: 10px; display: flex; justify-content: flex-start; }
        .issues-list { margin-top: 10px; }
        .issue-row { padding: 6px 0; display: flex; align-items: center; gap: 8px; }

        /* Empty State */
        .empty-state {
            padding: 30px;
            text-align: center;
            color: var(--vscode-descriptionForeground, #888);
            line-height: 1.6;
        }

        /* Security Welcome */
        .security-welcome {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
            flex: 1;
        }
        .welcome-icon { color: var(--vscode-button-background, #0e639c); margin-bottom: 16px; }
        .security-welcome h2 { margin-bottom: 12px; font-size: 18px; }
        .security-welcome p { color: var(--vscode-descriptionForeground, #888); margin-bottom: 24px; line-height: 1.5; }
        .primary-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--vscode-button-background, #0e639c);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .primary-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }

        /* Security Running */
        .security-running {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            text-align: center;
        }
        .running-icon { color: #ff9800; margin-bottom: 16px; }
        .logs-container {
            margin-top: 20px;
            width: 100%;
            max-height: 200px;
            overflow-y: auto;
            text-align: left;
            font-family: monospace;
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888);
        }
        .log-line { padding: 2px 0; }

        /* Security Results */
        .results-summary { padding: 14px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
        .results-summary h3 { margin-bottom: 10px; }
        .severity-summary { display: flex; gap: 8px; flex-wrap: wrap; }
        .sev-badge {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .sev-badge.critical { background: rgba(220,53,69,0.2); color: #dc3545; }
        .sev-badge.high { background: rgba(253,126,20,0.2); color: #fd7e14; }
        .sev-badge.medium { background: rgba(255,193,7,0.2); color: #ffc107; }
        .sev-badge.low { background: rgba(40,167,69,0.2); color: #28a745; }
        .sev-badge.info { background: rgba(23,162,184,0.2); color: #17a2b8; }

        /* Fixes */
        .fixes-section { padding: 8px 0; }
        .fix-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            border-bottom: 1px solid var(--vscode-panel-border, #2a2a2a);
        }
        .fix-file { display: flex; align-items: center; gap: 8px; }
        .fix-actions { display: flex; gap: 6px; }
        .action-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border: 1px solid;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            background: transparent;
        }
        .action-btn.accept { color: #28a745; border-color: #28a745; }
        .action-btn.accept:hover { background: rgba(40,167,69,0.2); }
        .action-btn.reject { color: #dc3545; border-color: #dc3545; }
        .action-btn.reject:hover { background: rgba(220,53,69,0.2); }

        /* Error */
        .security-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            text-align: center;
        }
        .error-icon { margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="brand-header">
        <div class="brand-title">TestPilot</div>
        <div class="brand-status">${this._escapeHtml(this._getContextStatusText())}</div>
    </div>
    <div class="toggle-container">
        <button class="toggle-btn ${this._selectedToggle === 'commits' ? 'active' : ''}" onclick="setToggle('commits')">Commit Reviews</button>
        <button class="toggle-btn ${this._selectedToggle === 'security' ? 'active' : ''}" onclick="setToggle('security')">Security Analysis</button>
    </div>
    <div class="content" style="flex:1; overflow-y:auto;">
        ${content}
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function setToggle(value) { vscode.postMessage({ type: 'toggleChange', value }); }
        function selectCommit(sha) { vscode.postMessage({ type: 'selectCommit', sha }); }
        function goBack() { vscode.postMessage({ type: 'goBack' }); }
        function openFile(file) { vscode.postMessage({ type: 'openFile', file }); }
        function toggleSection(section) { vscode.postMessage({ type: 'toggleSection', section }); }
        function startSecurityAnalysis() { vscode.postMessage({ type: 'startSecurityAnalysis' }); }
        function acceptFix(filename) { vscode.postMessage({ type: 'acceptFix', filename }); }
        function rejectFix(filename) { vscode.postMessage({ type: 'rejectFix', filename }); }
        function acceptCommitFix(filename) { vscode.postMessage({ type: 'acceptCommitFix', filename }); }
        function rejectCommitFix(filename) { vscode.postMessage({ type: 'rejectCommitFix', filename }); }
        function expandCommitFix(filename) { vscode.postMessage({ type: 'expandCommitFix', filename }); }
        function expandSecurityFix(filename) { vscode.postMessage({ type: 'expandSecurityFix', filename }); }
        function acceptSecurityFix(filename) { vscode.postMessage({ type: 'acceptSecurityFix', filename }); }
        function rejectSecurityFix(filename) { vscode.postMessage({ type: 'rejectSecurityFix', filename }); }
        function reviewCommit() { vscode.postMessage({ type: 'reviewCommit' }); }
    </script>
</body>
</html>`;
    }

    dispose(): void {
        this._securityAnalyzer.dispose();
    }
}
