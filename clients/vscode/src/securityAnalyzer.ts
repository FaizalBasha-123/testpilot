import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import * as JSZip from 'jszip';
import { StagingManager } from '../../../adapters/vscode/stagingManager';
import { gitHelper } from '../../../adapters/vscode/gitHelper';

const fetch: any = require('node-fetch');
const FormData: any = require('form-data');

export interface SecurityFinding {
    filename: string;
    line: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message: string;
    rule: string;
}

export interface FixProposal {
    filename: string;
    originalContent: string;
    newContent: string;
    unifiedDiff: string;
}

export interface AnalysisResult {
    status: 'pending' | 'running' | 'completed' | 'failed';
    findings: SecurityFinding[];
    fixes: FixProposal[];
    logs: string[];
    error?: string;
}

type AnalysisCallback = (result: AnalysisResult) => void;
type ContextProgressCallback = (progress: { state: string; percentage: number; detail: string }) => void;

/**
 * Handles security analysis: zip → upload → poll → fixes
 */
export class SecurityAnalyzer {
    private _activeJobId: string | null = null;
    private _pollingInterval: NodeJS.Timeout | null = null;
    private _stagingManager: StagingManager;
    private _outputChannel: vscode.OutputChannel;

    constructor(stagingManager: StagingManager) {
        this._stagingManager = stagingManager;
        this._outputChannel = vscode.window.createOutputChannel('TestPilot Security');
    }

    async startAnalysis(onUpdate: AnalysisCallback): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            onUpdate({ status: 'failed', findings: [], fixes: [], logs: [], error: 'No workspace open' });
            return;
        }

        onUpdate({ status: 'running', findings: [], fixes: [], logs: ['Zipping workspace...'] });

        try {
            // Zip the workspace
            const zip = new JSZip();
            await this._addFolderToZip(zip, workspacePath, workspacePath);
            const content = await zip.generateAsync({ type: 'nodebuffer' });

            onUpdate({ status: 'running', findings: [], fixes: [], logs: ['Uploading to analysis server...'] });

            // Get backend URL
            const config = vscode.workspace.getConfiguration('testpilot');
            const backendUrl = config.get<string>('backendUrl', 'https://testpilot-64v5.onrender.com');
            const gitContext = await this._collectGitContext(workspacePath);

            // Upload for analysis
            const form = new FormData();
            form.append('file', content, 'repo.zip');
            form.append('git_log', gitContext.gitLog);
            form.append('git_diff', gitContext.gitDiff);

            const response = await fetch(`${backendUrl}/api/v1/ide/review_repo_async`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const { job_id } = await response.json();
            this._activeJobId = job_id;

            onUpdate({ status: 'running', findings: [], fixes: [], logs: ['Analysis started...', `Job ID: ${job_id}`] });

            // Start polling
            this._startPolling(backendUrl, onUpdate);

        } catch (error: any) {
            this._outputChannel.appendLine(`[SecurityAnalyzer] Error: ${error}`);
            onUpdate({ status: 'failed', findings: [], fixes: [], logs: [], error: error.message || String(error) });
        }
    }

    private _startPolling(backendUrl: string, onUpdate: AnalysisCallback): void {
        if (this._pollingInterval) clearInterval(this._pollingInterval);

        this._pollingInterval = setInterval(async () => {
            if (!this._activeJobId) {
                this._stopPolling();
                return;
            }

            try {
                const statusUrl = `${backendUrl}/api/v1/ide/job_status/${this._activeJobId}`;
                const response = await fetch(statusUrl);

                if (response.ok) {
                    const data = await response.json();

                    if (data.status === 'completed') {
                        this._stopPolling();

                        // Parse findings and fixes
                        const findings: SecurityFinding[] = (data.result?.sonar_data || []).map((item: any) => ({
                            filename: item.file || 'unknown',
                            line: item.line || 1,
                            severity: this._mapSeverity(item.severity),
                            message: item.message || '',
                            rule: item.rule || ''
                        }));

                        const fixes: FixProposal[] = (data.result?.fixes || []).map((fix: any) => ({
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

                    } else if (data.status === 'failed') {
                        this._stopPolling();
                        onUpdate({
                            status: 'failed',
                            findings: [],
                            fixes: [],
                            logs: data.logs || [],
                            error: data.error || 'Analysis failed'
                        });

                    } else {
                        // Still running
                        onUpdate({
                            status: 'running',
                            findings: [],
                            fixes: [],
                            logs: data.logs || []
                        });
                    }
                }
            } catch (err) {
                this._outputChannel.appendLine(`[SecurityAnalyzer] Polling error: ${err}`);
            }
        }, 2000);
    }

    private _stopPolling(): void {
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = null;
        }
        this._activeJobId = null;
    }

    cancelAnalysis(): void {
        this._stopPolling();
    }

    async startContextBuild(onProgress: ContextProgressCallback): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            onProgress({ state: 'failed', percentage: 0, detail: 'No workspace open' });
            return;
        }

        onProgress({ state: 'running', percentage: 5, detail: 'Preparing workspace package' });

        try {
            const zip = new JSZip();
            await this._addFolderToZip(zip, workspacePath, workspacePath);
            const content = await zip.generateAsync({ type: 'nodebuffer' });
            const gitContext = await this._collectGitContext(workspacePath);

            const config = vscode.workspace.getConfiguration('testpilot');
            const backendUrl = config.get<string>('backendUrl', 'https://testpilot-64v5.onrender.com');

            const form = new FormData();
            form.append('file', content, 'repo.zip');
            form.append('git_diff', gitContext.gitDiff);

            const submitResponse = await fetch(`${backendUrl}/api/v1/ide/analyze_unified`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });

            if (!submitResponse.ok) {
                throw new Error(`Context build upload failed: ${submitResponse.status} ${submitResponse.statusText}`);
            }

            const { job_id } = await submitResponse.json();
            onProgress({ state: 'running', percentage: 10, detail: `Context job started (${job_id})` });

            let finished = false;
            while (!finished) {
                await new Promise(resolve => setTimeout(resolve, 2000));

                const statusResponse = await fetch(`${backendUrl}/api/v1/ide/job_status/${job_id}`);
                if (!statusResponse.ok) {
                    throw new Error(`Context status failed: ${statusResponse.status} ${statusResponse.statusText}`);
                }

                const statusData = await statusResponse.json();
                const status = statusData.status || 'pending';
                const progress = statusData.progress || {};
                const pct = Number(progress.percentage || 0);
                const currentFile = progress.current_file || '';

                if (status === 'completed') {
                    onProgress({ state: 'completed', percentage: 100, detail: 'Context graph and embeddings are ready' });
                    finished = true;
                } else if (status === 'failed') {
                    const err = statusData.result?.error || statusData.error || 'Context build failed';
                    onProgress({ state: 'failed', percentage: Math.max(0, pct), detail: String(err) });
                    finished = true;
                } else {
                    const detail = currentFile ? `Processing ${currentFile}` : 'Building context graph and embeddings';
                    onProgress({ state: 'running', percentage: Math.max(10, pct), detail });
                }
            }
        } catch (error: any) {
            this._outputChannel.appendLine(`[SecurityAnalyzer] Context build error: ${error}`);
            onProgress({ state: 'failed', percentage: 0, detail: error?.message || String(error) });
        }
    }

    async applyFix(fix: FixProposal): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = path.join(workspacePath, fix.filename);
        await this._stagingManager.stageFile(filePath, fix.newContent, true);
    }

    async acceptFix(fix: FixProposal): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = path.join(workspacePath, fix.filename);
        if (!this._stagingManager.isStaged(filePath)) {
            await this.applyFix(fix);
        }
        await this._stagingManager.acceptChange(filePath);
    }

    async rejectFix(fix: FixProposal): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return;

        const filePath = path.join(workspacePath, fix.filename);
        if (this._stagingManager.isStaged(filePath)) {
            await this._stagingManager.rejectChange(filePath);
        }
    }

    private _mapSeverity(severity: string): SecurityFinding['severity'] {
        const s = (severity || '').toLowerCase();
        if (s.includes('critical') || s.includes('blocker')) return 'critical';
        if (s.includes('high') || s.includes('major')) return 'high';
        if (s.includes('medium') || s.includes('minor')) return 'medium';
        if (s.includes('low')) return 'low';
        return 'info';
    }

    private async _collectGitContext(workspacePath: string): Promise<{ gitLog: string; gitDiff: string }> {
        // Use the same Git helper strategy used by commit list/review paths.
        const validation = await gitHelper.getValidationContext(workspacePath);
        const history = await gitHelper.getLog(workspacePath, 50);

        let gitDiff = (validation.diff || '').trim();
        if (!gitDiff) {
            const recent = await gitHelper.getRecentCommits(workspacePath, 1);
            if (recent.length > 0) {
                gitDiff = await gitHelper.getCommitDiff(workspacePath, recent[0].sha);
            }
        }

        let gitLog = (history || '').trim();
        if (!gitLog && validation.commits.length > 0) {
            gitLog = `Range: ${validation.range}\n` + validation.commits.join('\n');
        }

        return { gitLog: gitLog || '', gitDiff: gitDiff || '' };
    }

    private async _addFolderToZip(zip: any, folderPath: string, rootPath: string): Promise<void> {
        const excludeDirs = ['.git', 'node_modules', 'dist', 'out', '__pycache__', '.vscode', '.next', 'build', 'coverage', '.checkpoints', 'target'];
        const excludeExtensions = ['.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz'];

        const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const relPath = path.relative(rootPath, fullPath);

            if (entry.isDirectory()) {
                if (excludeDirs.includes(entry.name)) continue;
                await this._addFolderToZip(zip, fullPath, rootPath);
            } else {
                const ext = path.extname(entry.name).toLowerCase();
                if (excludeExtensions.includes(ext)) continue;

                try {
                    const content = await fs.promises.readFile(fullPath);
                    zip.file(relPath, content);
                } catch (e) {
                    // Skip files that can't be read
                }
            }
        }
    }

    dispose(): void {
        this._stopPolling();
    }
}

