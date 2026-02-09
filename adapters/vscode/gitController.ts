import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * GitController - Secure Git Operations for Phoenix Agent
 * 
 * Manages repository state programmatically using secure child_process.execFile.
 * Handles initialization, snapshotting (commits), and diff extraction.
 */
export class GitController {
    constructor(private workspaceRoot: string) { }

    /**
     * Execute a git command securely within the workspace root
     */
    private async execGit(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            // execFile is safer than exec as it avoids shell injection
            cp.execFile('git', args, { cwd: this.workspaceRoot, encoding: 'utf8' }, (err, stdout, stderr) => {
                if (err) {
                    // Git returns non-zero exit code for some valid operations (like empty diffs)
                    // But generally, we treat stderr as error content if exit code is non-zero
                    reject(stderr || err.message);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Check if .git directory exists
     */
    public async isGitInitialized(): Promise<boolean> {
        try {
            const gitDir = path.join(this.workspaceRoot, '.git');
            await fs.promises.access(gitDir);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Initialize repository if needed
     */
    public async init(): Promise<void> {
        if (await this.isGitInitialized()) return;

        console.log('[Phoenix] Initializing Git repository...');
        await this.execGit(['init']);
        // Initial commit to establish HEAD
        await this.execGit(['add', '-A']);
        await this.execGit(['commit', '-m', 'Phoenix Agent: Initializing workspace']);
    }

    /**
     * Create a pre-review snapshot (Stage A)
     * Commits all current changes so we can diff against HEAD~1 (or just HEAD if we want working tree diff)
     * 
     * Strategy:
     * 1. Add all changes.
     * 2. Commit with a specific message.
     */
    public async createSnapshot(message: string = 'Phoenix Agent: Pre-review snapshot'): Promise<void> {
        try {
            // Check if there are changes first
            const status = await this.execGit(['status', '--porcelain']);
            if (!status) {
                console.log('[Phoenix] No changes to snapshot.');
                return;
            }

            await this.execGit(['add', '-A']);
            await this.execGit(['commit', '-m', message]);
            console.log(`[Phoenix] Snapshot created: ${message}`);
        } catch (error: any) {
            console.error('[Phoenix] Snapshot failed:', error);
            throw new Error(`Failed to create snapshot: ${error}`);
        }
    }

    /**
     * Extract the unified diff for the last commit (HEAD)
     * Used to send context to the AI (Stage A).
     */
    public async getHeadDiff(): Promise<string> {
        try {
            // Diff the last commit against its parent
            // If it's the very first commit, HEAD~1 might fail.
            // Fallback: git show HEAD
            try {
                return await this.execGit(['diff', 'HEAD~1', 'HEAD', '--unified=3']);
            } catch {
                // Likely initial commit
                return await this.execGit(['show', 'HEAD', '--format=', '--unified=3']);
            }
        } catch (error: any) {
            console.error('[Phoenix] Failed to get diff:', error);
            throw error;
        }
    }

    /**
     * Extract diff of Working Tree vs HEAD (Uncommitted changes)
     * Useful if we want to review *without* committing first (optional flow)
     */
    public async getWorkingTreeDiff(): Promise<string> {
        return await this.execGit(['diff', 'HEAD', '--unified=3']);
    }
}
