package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
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
	log.Printf("[gateway-upload] incoming request method=%s path=%s remote=%s content_length=%d", r.Method, r.URL.Path, r.RemoteAddr, r.ContentLength)

	// Parse multipart form
	err := r.ParseMultipartForm(50 << 20) // 50 MB max
	if err != nil {
		log.Printf("[gateway-upload] parse form failed: %v", err)
		http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("[gateway-upload] missing file field: %v", err)
		http.Error(w, "Missing 'file' in form data", http.StatusBadRequest)
		return
	}
	defer file.Close()

	gitLog := r.FormValue("git_log")
	gitDiff := r.FormValue("git_diff")
	forceReview := r.FormValue("force_review")
	log.Printf("[gateway-upload] git context received git_log_chars=%d git_diff_chars=%d force_review=%q", len(gitLog), len(gitDiff), forceReview)

	// Create Job ID
	jobID := uuid.New().String()

	// Save zip to temp file because accessing 'file' in goroutine after handler return is unsafe
	tempDir := os.TempDir()
	tempPath := filepath.Join(tempDir, jobID+".zip")
	outFile, err := os.Create(tempPath)
	if err != nil {
		log.Printf("[gateway-upload:%s] failed to create temp file %s: %v", jobID, tempPath, err)
		http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
		return
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, file)
	if err != nil {
		log.Printf("[gateway-upload:%s] failed to persist uploaded file: %v", jobID, err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	log.Printf("[gateway-upload:%s] upload accepted filename=%s size=%d temp_path=%s", jobID, header.Filename, header.Size, tempPath)

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
	log.Printf("[gateway-upload:%s] queued async processing", jobID)

	// Start Async Processing
	go app.processScanJob(jobID, tempPath, gitLog, gitDiff, forceReview)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func (app *App) handleAnalyzeUnified(w http.ResponseWriter, r *http.Request) {
	log.Printf("[gateway-analyze-unified] incoming request method=%s path=%s remote=%s content_length=%d", r.Method, r.URL.Path, r.RemoteAddr, r.ContentLength)

	err := r.ParseMultipartForm(50 << 20) // 50 MB max
	if err != nil {
		log.Printf("[gateway-analyze-unified] parse form failed: %v", err)
		writeJSONError(w, http.StatusBadRequest, "Failed to parse form: "+err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("[gateway-analyze-unified] missing file field: %v", err)
		writeJSONError(w, http.StatusBadRequest, "Missing 'file' in form data")
		return
	}
	defer file.Close()

	gitDiff := r.FormValue("git_diff")

	requestID := uuid.New().String()

	// Save zip to temp file to avoid using file after handler returns
	tempDir := os.TempDir()
	tempPath := filepath.Join(tempDir, requestID+".zip")
	outFile, err := os.Create(tempPath)
	if err != nil {
		log.Printf("[gateway-analyze-unified:%s] failed to create temp file %s: %v", requestID, tempPath, err)
		writeJSONError(w, http.StatusInternalServerError, "Failed to create temp file")
		return
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, file)
	if err != nil {
		log.Printf("[gateway-analyze-unified:%s] failed to persist uploaded file: %v", requestID, err)
		writeJSONError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	log.Printf("[gateway-analyze-unified:%s] upload accepted filename=%s size=%d temp_path=%s", requestID, header.Filename, header.Size, tempPath)

	// Forward to AI Core
	aiCoreURL := os.Getenv("AI_CORE_URL")
	if strings.TrimSpace(app.cfg.AICoreURL) != "" {
		aiCoreURL = app.cfg.AICoreURL
	}
	if aiCoreURL == "" {
		aiCoreURL = "http://ai-core:3000"
	}
	log.Printf("[gateway-analyze-unified:%s] forwarding to ai_core=%s", requestID, aiCoreURL)

	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer writer.Close()

		if gitDiff != "" {
			if err := writer.WriteField("git_diff", gitDiff); err != nil {
				log.Printf("[gateway-analyze-unified:%s] failed to add git_diff field: %v", requestID, err)
			}
		}

		part, err := writer.CreateFormFile("file", "repo.zip")
		if err != nil {
			log.Printf("[gateway-analyze-unified:%s] failed to create multipart form field: %v", requestID, err)
			return
		}

		zipFile, err := os.Open(tempPath)
		if err != nil {
			log.Printf("[gateway-analyze-unified:%s] failed to open zip for forwarding: %v", requestID, err)
			return
		}
		defer zipFile.Close()

		if _, err := io.Copy(part, zipFile); err != nil {
			log.Printf("[gateway-analyze-unified:%s] failed to stream zip to multipart writer: %v", requestID, err)
		}
	}()

	targetURL := aiCoreURL + "/api/v1/ide/analyze_unified"
	req, err := http.NewRequest("POST", targetURL, pr)
	if err != nil {
		log.Printf("[gateway-analyze-unified:%s] failed to build request to ai-core: %v", requestID, err)
		writeJSONError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-Request-ID", requestID)
	log.Printf("[gateway-analyze-unified:%s] POST %s", requestID, targetURL)

	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[gateway-analyze-unified:%s] ai-core unreachable: %v", requestID, err)
		writeJSONError(w, http.StatusBadGateway, "AI Core unreachable: "+err.Error())
		return
	}
	defer resp.Body.Close()

	// Remove temp file after forwarding
	_ = os.Remove(tempPath)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("[gateway-analyze-unified:%s] failed to proxy response: %v", requestID, err)
	}
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

func (app *App) processScanJob(jobID string, zipPath string, gitLog string, gitDiff string, forceReview string) {
	defer os.Remove(zipPath) // Cleanup local temp zip

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

	update("running", "Forwarding to AI Core...")

	// 1. Forward ZIP to AI Core
	aiCoreURL := os.Getenv("AI_CORE_URL")
	if strings.TrimSpace(app.cfg.AICoreURL) != "" {
		aiCoreURL = app.cfg.AICoreURL
	}
	if aiCoreURL == "" {
		aiCoreURL = "http://ai-core:3000"
	}
	log.Printf("[gateway-job:%s] forwarding zip=%s to ai_core=%s git_log_chars=%d git_diff_chars=%d force_review=%q", jobID, zipPath, aiCoreURL, len(gitLog), len(gitDiff), forceReview)

	// Stream uploaded ZIP to AI Core to avoid buffering large files in memory.

	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer writer.Close()

		// Always forward context fields (even if empty) so AI Core
		// receives "" instead of None from Form(None) defaults.
		if err := writer.WriteField("git_log", gitLog); err != nil {
			log.Printf("[gateway-job:%s] failed to add git_log field: %v", jobID, err)
		}
		if err := writer.WriteField("git_diff", gitDiff); err != nil {
			log.Printf("[gateway-job:%s] failed to add git_diff field: %v", jobID, err)
		}
		if err := writer.WriteField("force_review", forceReview); err != nil {
			log.Printf("[gateway-job:%s] failed to add force_review field: %v", jobID, err)
		}

		// Add file
		part, err := writer.CreateFormFile("file", "repo.zip")
		if err != nil {
			log.Printf("[gateway-job:%s] failed to create multipart form field: %v", jobID, err)
			return
		}

		zipFile, err := os.Open(zipPath)
		if err != nil {
			log.Printf("[gateway-job:%s] failed to open zip for forwarding: %v", jobID, err)
			return
		}
		defer zipFile.Close()

		if _, err := io.Copy(part, zipFile); err != nil {
			log.Printf("[gateway-job:%s] failed to stream zip to multipart writer: %v", jobID, err)
		}
	}()

	targetURL := aiCoreURL + "/api/v1/ide/review_repo_async"
	req, err := http.NewRequest("POST", targetURL, pr)
	if err != nil {
		log.Printf("[gateway-job:%s] failed to build request to ai-core: %v", jobID, err)
		update("failed", "Failed to create request: "+err.Error())
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-Request-ID", jobID)
	log.Printf("[gateway-job:%s] POST %s", jobID, targetURL)

	client := &http.Client{Timeout: 0} // No timeout for upload? Maybe 5 mins
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[gateway-job:%s] ai-core unreachable: %v", jobID, err)
		update("failed", "AI Core unreachable: "+err.Error())
		return
	}
	defer resp.Body.Close()
	log.Printf("[gateway-job:%s] ai-core enqueue response status=%d", jobID, resp.StatusCode)

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		respSnippet := truncateForLog(string(bodyBytes), 800)
		log.Printf("[gateway-job:%s] ai-core enqueue failed status=%d body=%q", jobID, resp.StatusCode, respSnippet)
		if resp.StatusCode == http.StatusNotFound {
			log.Printf("[gateway-job:%s] ai-core returned 404 for %s (endpoint missing or app route not mounted)", jobID, targetURL)
		}
		update("failed", fmt.Sprintf("AI Core Error (%d): %s", resp.StatusCode, string(bodyBytes)))
		return
	}

	var aiResp map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
		log.Printf("[gateway-job:%s] invalid json from ai-core enqueue: %v", jobID, err)
		update("failed", "Invalid response from AI Core")
		return
	}

	aiJobID := aiResp["job_id"]
	log.Printf("[gateway-job:%s] ai-core accepted job ai_job_id=%s", jobID, aiJobID)
	update("running", fmt.Sprintf("AI Job Started (ID: %s). Polling...", aiJobID))

	// 2. Poll AI Core for Completion
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	timeout := time.After(10 * time.Minute)

	for {
		select {
		case <-timeout:
			update("failed", "Analysis timed out")
			return
		case <-ticker.C:
			// check status
			statusURL := fmt.Sprintf("%s/api/v1/ide/job_status/%s", aiCoreURL, aiJobID)
			statusReq, _ := http.NewRequest("GET", statusURL, nil)
			statusReq.Header.Set("X-Request-ID", jobID)
			statusResp, err := client.Do(statusReq)
			if err != nil {
				log.Printf("[gateway-job:%s] ai-core poll request failed: %v", jobID, err)
				continue // retry
			}

			var data struct {
				Status string      `json:"status"`
				Logs   []string    `json:"logs"`
				Result *ScanResult `json:"result,omitempty"`
				Error  string      `json:"error,omitempty"`
			}
			if err := json.NewDecoder(statusResp.Body).Decode(&data); err != nil {
				log.Printf("[gateway-job:%s] failed to decode poll response from %s status=%d error=%v", jobID, statusURL, statusResp.StatusCode, err)
			}
			statusResp.Body.Close()

			// Sync Logs
			jobsMut.Lock()
			if j, ok := jobs[jobID]; ok {
				// Naive log sync: just replace or append new ones?
				// Let's just take the last log from AI Core if it's new
				if len(data.Logs) > 0 {
					lastLog := data.Logs[len(data.Logs)-1]
					if len(j.Logs) == 0 || j.Logs[len(j.Logs)-1] != lastLog {
						j.Logs = append(j.Logs, lastLog)
					}
				}
				j.Status = data.Status
				log.Printf("[gateway-job:%s] poll status=%s ai_job_id=%s", jobID, data.Status, aiJobID)

				if data.Status == "completed" {
					j.Result = data.Result
					log.Printf("[gateway-job:%s] completed successfully", jobID)
					jobsMut.Unlock()
					return // Done
				}
				if data.Status == "failed" {
					j.Error = data.Error
					log.Printf("[gateway-job:%s] failed ai_job_id=%s error=%q", jobID, aiJobID, data.Error)
					jobsMut.Unlock()
					return // Done
				}
			} else {
				jobsMut.Unlock()
				return // Job killed locally?
			}
			jobsMut.Unlock()
		}
	}
}

func truncateForLog(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "...(truncated)"
}
