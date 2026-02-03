package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"
)

type Config struct {
	GitHubClientID      string
	GitHubClientSecret  string
	GitHubOAuthRedirect string
	GitHubWebhookSecret string
	GitHubAppID         int64
	GitHubAppPrivateKey string
	JWTSecret           string
	DatabaseURL         string
	FrontendURL         string
	BackendURL          string
	GitHubAppInstallURL string
}

type App struct {
	cfg    Config
	db     *sql.DB
	jwtKey []byte
}

func main() {
	cfg := loadConfig()
	db, err := initDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db init failed: %v", err)
	}
	defer db.Close()

	app := &App{cfg: cfg, db: db, jwtKey: []byte(cfg.JWTSecret)}

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/login", app.handleGitHubLogin)
	mux.HandleFunc("/auth/callback", app.handleGitHubCallback)
	mux.HandleFunc("/webhooks/github", app.handleGitHubWebhook)
	mux.HandleFunc("/api/orgs", app.authMiddleware(app.handleListOrgs))
	mux.HandleFunc("/api/repos", app.authMiddleware(app.handleListRepos))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	server := &http.Server{
		Addr:              ":8001",
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Println("git-app-backend listening on :8001")
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func loadConfig() Config {
	return Config{
		GitHubClientID:      os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret:  os.Getenv("GITHUB_CLIENT_SECRET"),
		GitHubOAuthRedirect: os.Getenv("GITHUB_OAUTH_REDIRECT"),
		GitHubWebhookSecret: os.Getenv("GITHUB_WEBHOOK_SECRET"),
		GitHubAppID:         mustInt64("GITHUB_APP_ID"),
		GitHubAppPrivateKey: os.Getenv("GITHUB_APP_PRIVATE_KEY"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		FrontendURL:         os.Getenv("FRONTEND_URL"),
		BackendURL:          os.Getenv("BACKEND_URL"),
		GitHubAppInstallURL: os.Getenv("GITHUB_APP_INSTALL_URL"),
	}
}

func mustInt64(name string) int64 {
	val := os.Getenv(name)
	if val == "" {
		return 0
	}
	parsed, err := parseInt64(val)
	if err != nil {
		log.Fatalf("invalid %s: %v", name, err)
	}
	return parsed
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
