package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Job Store (In-memory for MVP)
var (
	jobs    = make(map[string]*ScanJob)
	jobsMut sync.RWMutex
)

type ScanJob struct {
	ID        string      `json:"job_id"`
	Status    string      `json:"status"` // pending, running, completed, failed, cancelled
	Logs      []string    `json:"logs"`
	Result    *ScanResult `json:"result,omitempty"`
	Error     string      `json:"error,omitempty"`
	CreatedAt time.Time
}

type ScanResult struct {
	SonarData []SonarIssue  `json:"sonar_data"`
	Fixes     []FixProposal `json:"fixes"`
}

type SonarIssue struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Rule     string `json:"rule"`
}

type FixProposal struct {
	Filename        string `json:"filename"`
	OriginalContent string `json:"original_content"`
	NewContent      string `json:"new_content"`
	UnifiedDiff     string `json:"unified_diff"`
}

func (app *App) handleReviewRepoAsync(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	err := r.ParseMultipartForm(50 << 20) // 50 MB max
	if err != nil {
		http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing 'file' in form data", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Create Job ID
	jobID := uuid.New().String()

	// Save zip to temp file because accessing 'file' in goroutine after handler return is unsafe
	tempDir := os.TempDir()
	tempPath := filepath.Join(tempDir, jobID+".zip")
	outFile, err := os.Create(tempPath)
	if err != nil {
		http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
		return
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, file)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Initialize Job
	job := &ScanJob{
		ID:        jobID,
		Status:    "pending",
		Logs:      []string{"Job created", fmt.Sprintf("Received file: %s (%d bytes)", header.Filename, header.Size)},
		CreatedAt: time.Now(),
	}

	jobsMut.Lock()
	jobs[jobID] = job
	jobsMut.Unlock()

	// Respond immediately
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"job_id": jobID})

	// Start Async Processing
	go app.processScanJob(jobID, tempPath)
}

func (app *App) handleJobStatus(w http.ResponseWriter, r *http.Request) {
	// Extract Job ID from URL path
	// URL: /api/v1/ide/job_status/{id}
	// Split: ["", "api", "v1", "ide", "job_status", "UUID"]
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 6 {
		http.Error(w, "Invalid request path", http.StatusBadRequest)
		return
	}
	jobID := parts[5]

	jobsMut.RLock()
	job, exists := jobs[jobID]
	jobsMut.RUnlock()

	if !exists {
		http.Error(w, "Job not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func (app *App) handleCancelJob(w http.ResponseWriter, r *http.Request) {
	// Extract Job ID from URL path (e.g. /api/v1/ide/cancel/{id})
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 6 {
		http.Error(w, "Invalid request path", http.StatusBadRequest)
		return
	}
	jobID := parts[5]

	jobsMut.Lock()
	if job, exists := jobs[jobID]; exists {
		job.Status = "cancelled"
		job.Logs = append(job.Logs, "Job cancelled by user")
	}
	jobsMut.Unlock()

	w.WriteHeader(http.StatusOK)
}

func (app *App) processScanJob(jobID string, zipPath string) {
	defer os.Remove(zipPath) // Cleanup

	// Helper to update status
	update := func(status string, msg string) {
		jobsMut.Lock()
		if j, ok := jobs[jobID]; ok {
			j.Status = status
			if msg != "" {
				j.Logs = append(j.Logs, msg)
			}
		}
		jobsMut.Unlock()
	}

	update("running", "Unzipping workspace...")
	time.Sleep(1 * time.Second)

	update("running", "Analyzing project structure...")
	time.Sleep(1 * time.Second)

	update("running", "Running SonarQube rules (Mock)...")
	time.Sleep(2 * time.Second)

	// Mock Findings
	sonarIssues := []SonarIssue{
		{File: "services/git-app-backend/main.go", Line: 45, Severity: "HIGH", Message: "Hardcoded secret detected", Rule: "S1234"},
		{File: "clients/vscode/src/extension.ts", Line: 10, Severity: "MEDIUM", Message: "Cognitive Complexity is too high", Rule: "S3456"},
	}

	update("running", fmt.Sprintf("Found %d issues. Generating AI fixes...", len(sonarIssues)))
	time.Sleep(2 * time.Second)

	// Mock Fixes
	fixes := []FixProposal{
		{
			Filename:        "services/git-app-backend/main.go",
			OriginalContent: "secret := \"hardcoded-value\"",
			NewContent:      "secret := os.Getenv(\"MY_SECRET\")",
			UnifiedDiff:     "",
		},
	}

	jobsMut.Lock()
	if j, ok := jobs[jobID]; ok {
		j.Status = "completed"
		j.Result = &ScanResult{
			SonarData: sonarIssues,
			Fixes:     fixes,
		}
		j.Logs = append(j.Logs, "Analysis complete.")
	}
	jobsMut.Unlock()
}
