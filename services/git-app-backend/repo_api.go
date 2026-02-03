package main

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/go-github/v61/github"
	"golang.org/x/oauth2"
)

func (a *App) handleListRepos(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(ctxKeyUserID{}).(int64)
	user, err := getUserByID(a.db, userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return
	}

	token := &oauth2.Token{AccessToken: user.AccessToken}
	client := github.NewClient(oauth2.NewClient(context.Background(), oauth2.StaticTokenSource(token)))
	repos, _, err := client.Repositories.List(context.Background(), "", &github.RepositoryListOptions{
		ListOptions: github.ListOptions{PerPage: 100},
		Visibility:  "all",
	})
	if err != nil {
		http.Error(w, "github error", http.StatusBadGateway)
		return
	}

	response := make([]map[string]any, 0, len(repos))
	for _, repo := range repos {
		response = append(response, map[string]any{
			"id":        repo.GetID(),
			"name":      repo.GetName(),
			"full_name": repo.GetFullName(),
			"private":   repo.GetPrivate(),
			"url":       repo.GetHTMLURL(),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"repos":       response,
		"install_url": strings.TrimSpace(a.cfg.GitHubAppInstallURL),
	})
}
