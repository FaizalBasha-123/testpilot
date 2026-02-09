package main

// GitHub org listing endpoint for onboarding.

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/go-github/v61/github"
	"golang.org/x/oauth2"
)

func (a *App) handleListOrgs(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(ctxKeyUserID{}).(int64)
	user, err := getUserByID(a.db, userID)
	if err != nil {
		http.Error(w, "user not found", http.StatusUnauthorized)
		return
	}

	token := &oauth2.Token{AccessToken: user.AccessToken}
	client := github.NewClient(oauth2.NewClient(context.Background(), oauth2.StaticTokenSource(token)))

	ghUser, _, err := client.Users.Get(context.Background(), "")
	if err != nil {
		http.Error(w, "github error", http.StatusBadGateway)
		return
	}

	orgs, _, err := client.Organizations.List(context.Background(), "", &github.ListOptions{PerPage: 100})
	if err != nil {
		http.Error(w, "github error", http.StatusBadGateway)
		return
	}

	orgList := make([]map[string]any, 0, len(orgs))
	for _, org := range orgs {
		orgList = append(orgList, map[string]any{
			"id":         org.GetID(),
			"login":      org.GetLogin(),
			"type":       org.GetType(),
			"avatar_url": org.GetAvatarURL(),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"account": map[string]any{
			"id":         ghUser.GetID(),
			"login":      ghUser.GetLogin(),
			"type":       "User",
			"avatar_url": ghUser.GetAvatarURL(),
		},
		"orgs":        orgList,
		"install_url": strings.TrimSpace(a.cfg.GitHubAppInstallURL),
	})
}
