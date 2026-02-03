package main

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func (a *App) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authorization := r.Header.Get("Authorization")
		if authorization == "" {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}
		parts := strings.SplitN(authorization, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		token, err := jwt.Parse(parts[1], func(t *jwt.Token) (any, error) {
			return a.jwtKey, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		sub, ok := claims["sub"].(float64)
		if !ok {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxKeyUserID{}, int64(sub))
		next(w, r.WithContext(ctx))
	}
}
