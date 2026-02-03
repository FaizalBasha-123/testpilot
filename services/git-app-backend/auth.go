package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-github/v61/github"
	"golang.org/x/oauth2"
	githuboauth "golang.org/x/oauth2/github"
)

func (a *App) handleGitHubLogin(w http.ResponseWriter, r *http.Request) {
	state, err := randomState()
	if err != nil {
		http.Error(w, "state error", http.StatusInternalServerError)
		return
	}
	redirectURL := a.oauthConfig().AuthCodeURL(state, oauth2.AccessTypeOnline)
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		HttpOnly: true,
		Path:     "/",
		MaxAge:   300,
	})
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (a *App) handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	stored, err := r.Cookie("oauth_state")
	if err != nil || stored.Value != state {
		http.Error(w, "invalid state", http.StatusUnauthorized)
		return
	}

	token, err := a.oauthConfig().Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "token exchange failed", http.StatusInternalServerError)
		return
	}

	client := github.NewClient(a.oauthConfig().Client(context.Background(), token))
	user, _, err := client.Users.Get(context.Background(), "")
	if err != nil {
		http.Error(w, "user fetch failed", http.StatusInternalServerError)
		return
	}

	userID, err := upsertUser(a.db, user.GetID(), user.GetLogin(), token.AccessToken)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	jwtToken, err := a.issueJWT(userID)
	if err != nil {
		http.Error(w, "jwt error", http.StatusInternalServerError)
		return
	}

	// Redirect to the same domain (Render backend serves frontend)
	redirect := fmt.Sprintf("%s/auth/workspace?token=%s", a.cfg.BackendURL, jwtToken)
	http.Redirect(w, r, redirect, http.StatusFound)
}

func (a *App) issueJWT(userID int64) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.jwtKey)
}

func (a *App) oauthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     a.cfg.GitHubClientID,
		ClientSecret: a.cfg.GitHubClientSecret,
		RedirectURL:  a.cfg.GitHubOAuthRedirect,
		Scopes:       []string{"repo", "read:user"},
		Endpoint:     githuboauth.Endpoint,
	}
}

func randomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
