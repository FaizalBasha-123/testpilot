"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalFixState = void 0;
const vscode = require("vscode");
/**
 * Manages the global state of pending fixes across the workspace.
 * Persists state to workspaceState so it survives window reloads.
 */
class GlobalFixState {
    constructor(context) {
        this._fixes = new Map();
        // Event emitter for state changes (UI updates)
        this._onDidChangeState = new vscode.EventEmitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._context = context;
        this.loadState();
    }
    /**
     * Loads persisted state from workspace storage.
     */
    loadState() {
        const stored = this._context.workspaceState.get(GlobalFixState.STORAGE_KEY);
        if (stored) {
            this._fixes = new Map(stored);
        }
    }
    /**
     * Persists current state to workspace storage.
     */
    saveState() {
        // Map is not JSON serializable, convert to array of entries
        this._context.workspaceState.update(GlobalFixState.STORAGE_KEY, Array.from(this._fixes.entries()));
        this._onDidChangeState.fire();
    }
    /**
     * Adds or updates a pending fix.
     */
    setFix(filename, fix) {
        this._fixes.set(filename, fix);
        this.saveState();
    }
    /**
     * Removes a fix (e.g., after acceptance or rejection).
     */
    removeFix(filename) {
        this._fixes.delete(filename);
        this.saveState();
    }
    /**
     * Gets a specific fix.
     */
    getFix(filename) {
        return this._fixes.get(filename);
    }
    /**
     * Returns all pending fixes as an array.
     */
    getAllFixes() {
        return Array.from(this._fixes.values());
    }
    /**
     * Clears all state (e.g., new scan started).
     */
    clearAll() {
        this._fixes.clear();
        this.saveState();
    }
    /**
     * Checks if there are any pending fixes.
     */
    hasFixes() {
        return this._fixes.size > 0;
    }
}
exports.GlobalFixState = GlobalFixState;
GlobalFixState.STORAGE_KEY = 'blackbox.pendingFixes';
//# sourceMappingURL=globalFixState.js.map