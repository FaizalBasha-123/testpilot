package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/bradleyfalzon/ghinstallation/v2"
	"github.com/google/go-github/v61/github"
)

func (a *App) handleGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	payload, err := github.ValidatePayload(r, []byte(a.cfg.GitHubWebhookSecret))
	if err != nil {
		http.Error(w, "invalid payload", http.StatusUnauthorized)
		return
	}

	event, err := github.ParseWebHook(github.WebHookType(r), payload)
	if err != nil {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}

	switch e := event.(type) {
	case *github.PushEvent:
		a.handlePushEvent(w, e)
	case *github.PullRequestEvent:
		a.handlePullRequestEvent(w, e)
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (a *App) handlePushEvent(w http.ResponseWriter, e *github.PushEvent) {
	if e.GetRef() != "refs/heads/main" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if e.Installation == nil {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	owner := e.GetRepo().GetOwner().GetLogin()
	repo := e.GetRepo().GetName()
	installationID := e.Installation.GetID()

	go func() {
		if err := a.runMockAgent(owner, repo, installationID); err != nil {
			fmt.Printf("mock agent error: %v\n", err)
		}
	}()

	w.WriteHeader(http.StatusAccepted)
}

func (a *App) handlePullRequestEvent(w http.ResponseWriter, e *github.PullRequestEvent) {
	action := e.GetAction()
	if action != "opened" && action != "synchronize" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if e.Installation == nil {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	owner := e.GetRepo().GetOwner().GetLogin()
	repo := e.GetRepo().GetName()
	number := e.GetNumber()
	installationID := e.Installation.GetID()

	go func() {
		if err := a.runMockReview(owner, repo, number, installationID); err != nil {
			fmt.Printf("mock review error: %v\n", err)
		}
	}()

	w.WriteHeader(http.StatusAccepted)
}

func (a *App) runMockAgent(owner, repo string, installationID int64) error {
	client, err := a.newInstallationClient(installationID)
	if err != nil {
		return err
	}
	ctx := context.Background()

	mainRef, _, err := client.Git.GetRef(ctx, owner, repo, "refs/heads/main")
	if err != nil {
		return err
	}

	branchName := fmt.Sprintf("ai-fix-optimization-%d", time.Now().Unix())
	newRef := &github.Reference{
		Ref: github.String("refs/heads/" + branchName),
		Object: &github.GitObject{
			SHA: mainRef.Object.SHA,
		},
	}
	_, _, err = client.Git.CreateRef(ctx, owner, repo, newRef)
	if err != nil && !strings.Contains(err.Error(), "Reference already exists") {
		return err
	}

	content := mockReportContent(owner, repo)
	path := "ai_optimization_report.md"

	file, _, _, err := client.Repositories.GetContents(ctx, owner, repo, path, &github.RepositoryContentGetOptions{Ref: branchName})
	if err == nil && file != nil && file.SHA != nil {
		_, _, err = client.Repositories.UpdateFile(ctx, owner, repo, path, &github.RepositoryContentFileOptions{
			Message: github.String("chore: add AI optimization report (mock)"),
			Content: []byte(content),
			SHA:     file.SHA,
			Branch:  github.String(branchName),
		})
		if err != nil {
			return err
		}
	} else {
		_, _, err = client.Repositories.CreateFile(ctx, owner, repo, path, &github.RepositoryContentFileOptions{
			Message: github.String("chore: add AI optimization report (mock)"),
			Content: []byte(content),
			Branch:  github.String(branchName),
		})
		if err != nil {
			return err
		}
	}

	prBody := mockPRBody(owner, repo)
	pr := &github.NewPullRequest{
		Title: github.String("AI Optimization Suggestions (Mock)"),
		Head:  github.String(branchName),
		Base:  github.String("main"),
		Body:  github.String(prBody),
	}
	_, _, err = client.PullRequests.Create(ctx, owner, repo, pr)
	return err
}

func (a *App) runMockReview(owner, repo string, number int, installationID int64) error {
	client, err := a.newInstallationClient(installationID)
	if err != nil {
		return err
	}
	ctx := context.Background()
	body := mockReviewBody(owner, repo, number)
	review := &github.PullRequestReviewRequest{
		Body:  github.String(body),
		Event: github.String("COMMENT"),
	}
	_, _, err = client.PullRequests.CreateReview(ctx, owner, repo, number, review)
	return err
}

func (a *App) newInstallationClient(installationID int64) (*github.Client, error) {
	key := []byte(strings.ReplaceAll(a.cfg.GitHubAppPrivateKey, "\\n", "\n"))
	tr, err := ghinstallation.New(http.DefaultTransport, a.cfg.GitHubAppID, installationID, key)
	if err != nil {
		return nil, err
	}
	return github.NewClient(&http.Client{Transport: tr}), nil
}

func mockReportContent(owner, repo string) string {
	payload := map[string]any{
		"repo":   fmt.Sprintf("%s/%s", owner, repo),
		"score":  94,
		"wins":   []string{"Reduced cold start time", "Improved query batching", "De-duplicated cache keys"},
		"notes":  "This is a mocked AI report generated instantly for hackathon demo purposes.",
		"impact": "~18% faster requests and ~22% lower DB load (simulated)",
	}
	b, _ := json.MarshalIndent(payload, "", "  ")

	var buf bytes.Buffer
	buf.WriteString("# AI Optimization Report (Mock)\n\n")
	buf.WriteString("**Generated:** " + time.Now().Format(time.RFC1123) + "\n\n")
	buf.WriteString("## Highlights\n")
	buf.WriteString("- \U0001F680 Hot path micro-optimizations\n")
	buf.WriteString("- \U0001F9E0 Smarter batching and caching\n")
	buf.WriteString("- \u26A1 Lowered latency and CPU\n\n")
	buf.WriteString("## Summary (JSON)\n")
	buf.WriteString("```json\n" + string(b) + "\n```\n")
	buf.WriteString("\n> This is demo content. Replace with real AI output later.\n")
	return buf.String()
}

func mockPRBody(owner, repo string) string {
	return fmt.Sprintf("\n## \U0001F916 AI Agent Summary (Mock)\n\nI analyzed **%s/%s** and found quick wins that can be safely automated.\n\n### \U0001F50D What Changed\n- Added `ai_optimization_report.md` with optimization highlights\n- Mocked performance analysis summary with JSON report\n\n### \U0001F9EA Estimated Impact (Simulated)\n- **Latency:** -18%%\n- **DB Load:** -22%%\n- **Cold Start:** -35%%\n\n### \u2705 Next Steps\n- Review the report\n- Merge if acceptable\n- Replace mock generator with real AI pipeline\n\n> This PR was generated instantly for hackathon demo purposes.\n", owner, repo)
}

func mockReviewBody(owner, repo string, number int) string {
	return fmt.Sprintf("\n## \U0001F9EA TestPilot Review (Mock)\n\nAutomated review for **%s/%s** (PR #%d).\n\n### Highlights\n- \u2705 No blocking issues detected\n- \u26A0\uFE0F Suggested: add a brief performance note in the README\n- \u27A1\uFE0F Consider enabling caching for repeated queries\n\n> This is simulated output for hackathon demo purposes.\n", owner, repo, number)
}

