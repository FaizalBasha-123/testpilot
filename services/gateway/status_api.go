package main

import (
	"context"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

type ServiceStatus struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	Configured bool   `json:"configured"`
	Reachable  bool   `json:"reachable"`
	StatusCode int    `json:"status_code,omitempty"`
	Error      string `json:"error,omitempty"`
}

type RuntimeGitStatus struct {
	Installed bool   `json:"installed"`
	Version   string `json:"version,omitempty"`
	Path      string `json:"path,omitempty"`
}

func (a *App) handleMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(ctxKeyUserID{}).(int64)
	user, err := getUserByID(a.db, userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":               user.ID,
		"github_id":        user.GitHubID,
		"login":            user.Login,
		"github_install":   strings.TrimSpace(a.cfg.GitHubAppInstallURL),
		"backend_url":      strings.TrimSpace(a.cfg.BackendURL),
		"frontend_url":     strings.TrimSpace(a.cfg.FrontendURL),
		"mock_review_mode": a.cfg.EnableMockReview,
	})
}

func (a *App) handleStatus(w http.ResponseWriter, r *http.Request) {
	ai := checkService("ai_core", a.cfg.AICoreURL)
	sonar := checkService("sonar_service", a.cfg.SonarServiceURL)
	webhook := ServiceStatus{
		Name:       "ai_review_webhook",
		URL:        strings.TrimSpace(a.cfg.AIReviewWebhookURL),
		Configured: strings.TrimSpace(a.cfg.AIReviewWebhookURL) != "",
		Reachable:  strings.TrimSpace(a.cfg.AIReviewWebhookURL) != "",
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"gateway": map[string]any{
			"reachable": true,
			"mock_mode": a.cfg.EnableMockReview,
		},
		"runtime": map[string]any{
			"git": detectGitRuntime(),
		},
		"services": []ServiceStatus{ai, sonar, webhook},
		"capabilities": []string{
			"github_oauth",
			"github_app_webhooks",
			"vscode_review_async",
			"sonar_scanner_pipeline",
			"ai_core_orchestration",
			"job_cancel_supported",
		},
	})
}

func detectGitRuntime() RuntimeGitStatus {
	result := RuntimeGitStatus{Installed: false}
	path, err := exec.LookPath("git")
	if err != nil {
		return result
	}

	result.Path = path
	out, err := exec.Command("git", "--version").Output()
	if err != nil {
		result.Installed = true
		return result
	}

	result.Installed = true
	result.Version = strings.TrimSpace(string(out))
	return result
}

func checkService(name, baseURL string) ServiceStatus {
	url := strings.TrimSpace(baseURL)
	status := ServiceStatus{
		Name:       name,
		URL:        url,
		Configured: url != "",
		Reachable:  false,
	}
	if url == "" {
		return status
	}

	healthURL := strings.TrimRight(url, "/") + "/health"
	client := &http.Client{Timeout: 3 * time.Second}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
	if err != nil {
		status.Error = err.Error()
		return status
	}

	resp, err := client.Do(req)
	if err != nil {
		status.Error = err.Error()
		return status
	}
	defer resp.Body.Close()

	status.StatusCode = resp.StatusCode
	// Reachable means the remote endpoint responded; exact status varies by service.
	status.Reachable = true
	return status
}

