package main

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
)

// ReviewRequest is the payload from VS Code extension
type ReviewRequest struct {
	Repo      string   `json:"repo"`
	CommitSHA string   `json:"commit_sha"`
	Diff      string   `json:"diff"`
	Files     []string `json:"files"`
}

// ReviewIssue represents a detected issue
type ReviewIssue struct {
	Severity    string `json:"severity"` // "error", "warning", "info"
	Description string `json:"description"`
	File        string `json:"file,omitempty"`
	Line        int    `json:"line,omitempty"`
}

// ReviewSuggestion represents an improvement suggestion
type ReviewSuggestion struct {
	Description string `json:"description"`
	File        string `json:"file,omitempty"`
	Line        int    `json:"line,omitempty"`
}

// ReviewResponse is returned to the extension
type ReviewResponse struct {
	Summary     string             `json:"summary"`
	Score       int                `json:"score"`
	Issues      []ReviewIssue      `json:"issues"`
	Suggestions []ReviewSuggestion `json:"suggestions"`
}

// handleReviewCommit processes commit review requests from VS Code
// TODO: Add JWT middleware here for production
func (a *App) handleReviewCommit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	if req.Diff == "" {
		http.Error(w, "Diff is required", http.StatusBadRequest)
		return
	}

	// Mock heuristic review is intentionally disabled.
	// Clients must use AI-core async analysis endpoints via /api/v1/ide/review_repo_async.
	http.Error(w, "review-commit endpoint disabled; use /api/v1/ide/review_repo_async for real analysis", http.StatusGone)
}

// analyzeDiff performs mock heuristic analysis on the diff
func analyzeDiff(req ReviewRequest) ReviewResponse {
	var issues []ReviewIssue
	var suggestions []ReviewSuggestion
	diff := req.Diff

	// Heuristic 1: TODO/FIXME comments
	todoRe := regexp.MustCompile(`(?i)(TODO|FIXME|XXX|HACK)`)
	if todoRe.MatchString(diff) {
		issues = append(issues, ReviewIssue{
			Severity:    "warning",
			Description: "Found TODO/FIXME comment that should be addressed",
		})
	}

	// Heuristic 2: console.log in JS/TS
	if strings.Contains(diff, "console.log") {
		issues = append(issues, ReviewIssue{
			Severity:    "info",
			Description: "console.log statement should be removed before production",
		})
	}

	// Heuristic 3: Missing error handling in Go
	if strings.Contains(diff, ".go") || hasGoFiles(req.Files) {
		if strings.Contains(diff, "err :=") && !strings.Contains(diff, "if err != nil") {
			issues = append(issues, ReviewIssue{
				Severity:    "error",
				Description: "Potential unhandled error in Go code",
			})
		}
	}

	// Heuristic 4: Async without try/catch in JS/TS
	if strings.Contains(diff, "async") && !strings.Contains(diff, "try") {
		issues = append(issues, ReviewIssue{
			Severity:    "warning",
			Description: "Async function without try/catch error handling",
		})
	}

	// Heuristic 5: Large diff suggests refactoring
	lineCount := strings.Count(diff, "\n")
	if lineCount > 200 {
		suggestions = append(suggestions, ReviewSuggestion{
			Description: "Large change detected. Consider breaking into smaller commits for easier review.",
		})
	}

	// Heuristic 6: No test files modified
	hasTests := false
	for _, f := range req.Files {
		if strings.Contains(f, "test") || strings.Contains(f, "spec") || strings.Contains(f, "_test.go") {
			hasTests = true
			break
		}
	}
	if !hasTests && len(req.Files) > 0 {
		suggestions = append(suggestions, ReviewSuggestion{
			Description: "Consider adding test coverage for these changes.",
		})
	}

	// Calculate score based on issues
	score := 100
	for _, issue := range issues {
		switch issue.Severity {
		case "error":
			score -= 20
		case "warning":
			score -= 10
		case "info":
			score -= 5
		}
	}
	if score < 0 {
		score = 0
	}

	// Generate summary
	summary := generateSummary(score, len(issues), len(suggestions))

	return ReviewResponse{
		Summary:     summary,
		Score:       score,
		Issues:      issues,
		Suggestions: suggestions,
	}
}

func hasGoFiles(files []string) bool {
	for _, f := range files {
		if strings.HasSuffix(f, ".go") {
			return true
		}
	}
	return false
}

func generateSummary(score int, issueCount int, suggestionCount int) string {
	if score >= 90 {
		return "Excellent code quality! No significant issues found."
	} else if score >= 70 {
		return "Good code quality with minor suggestions for improvement."
	} else if score >= 50 {
		return "Code has some issues that should be addressed before merging."
	} else {
		return "Several issues detected. Please review and fix before proceeding."
	}
}
