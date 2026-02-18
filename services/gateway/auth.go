package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
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
		Secure:   isHTTPSRequest(r),
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		MaxAge:   300,
	})
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (a *App) handleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")

	// Validate state parameter
	if state == "" {
		http.Error(w, "missing state parameter", http.StatusBadRequest)
		return
	}

	// Validate authorization code
	if code == "" {
		http.Error(w, "missing authorization code", http.StatusBadRequest)
		return
	}

	// Verify state matches stored cookie
	stored, err := r.Cookie("oauth_state")
	if err != nil {
		http.Error(w, "state cookie not found - possible CSRF attack", http.StatusUnauthorized)
		return
	}

	if stored.Value != state {
		http.Error(w, "state mismatch - possible CSRF attack", http.StatusUnauthorized)
		return
	}

	// Exchange code for access token
	token, err := a.oauthConfig().Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "failed to exchange authorization code: "+err.Error(), http.StatusUnauthorized)
		return
	}
	if strings.TrimSpace(token.AccessToken) == "" {
		http.Error(w, "oauth exchange returned empty access token", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tokenSource := oauth2.StaticTokenSource(&oauth2.Token{
		AccessToken: token.AccessToken,
		TokenType:   "bearer",
	})
	httpClient := oauth2.NewClient(ctx, tokenSource)
	client := github.NewClient(httpClient)
	client.UserAgent = "testpilot-gateway/1.0"
	user, resp, err := client.Users.Get(ctx, "")
	if err != nil {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}
		log.Printf("oauth callback user fetch failed status=%d err=%v", status, err)
		http.Error(w, fmt.Sprintf("user fetch failed (github status=%d): %v", status, err), http.StatusBadGateway)
		return
	}
	if user.GetID() == 0 || strings.TrimSpace(user.GetLogin()) == "" {
		log.Printf("oauth callback user payload incomplete id=%d login=%q", user.GetID(), user.GetLogin())
		http.Error(w, "user fetch failed: github user payload incomplete", http.StatusBadGateway)
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

	// Always return to the active gateway host handling this callback.
	redirect := fmt.Sprintf("%s/auth/workspace?token=%s", requestOrigin(r), url.QueryEscape(jwtToken))
	http.Redirect(w, r, redirect, http.StatusFound)
}

func (a *App) handleGitHubInstallStart(w http.ResponseWriter, r *http.Request) {
	installURL := strings.TrimSpace(a.cfg.GitHubAppInstallURL)
	if installURL == "" {
		http.Error(w, "missing install url", http.StatusInternalServerError)
		return
	}

	state, err := randomState()
	if err != nil {
		http.Error(w, "state error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		HttpOnly: true,
		Secure:   isHTTPSRequest(r),
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		MaxAge:   300,
	})

	parsed, err := url.Parse(installURL)
	if err != nil {
		http.Error(w, "invalid install url", http.StatusInternalServerError)
		return
	}

	query := parsed.Query()
	query.Set("state", state)
	if targetID := r.URL.Query().Get("target_id"); targetID != "" {
		query.Set("target_id", targetID)
	}
	parsed.RawQuery = query.Encode()

	http.Redirect(w, r, parsed.String(), http.StatusFound)
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

func requestOrigin(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); forwarded != "" {
		host := strings.TrimSpace(r.Host)
		if host != "" {
			return forwarded + "://" + host
		}
	}
	if r.TLS != nil {
		return "https://" + r.Host
	}
	return "http://" + r.Host
}

func isHTTPSRequest(r *http.Request) bool {
	if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https") {
		return true
	}
	return r.TLS != nil
}
