package main

import (
	"errors"
	"os"
	"strconv"
)

func parseInt64(val string) (int64, error) {
	if val == "" {
		return 0, errors.New("empty value")
	}
	return strconv.ParseInt(val, 10, 64)
}

func parseBoolEnv(name string, defaultVal bool) bool {
	val := os.Getenv(name)
	if val == "" {
		return defaultVal
	}
	parsed, err := strconv.ParseBool(val)
	if err != nil {
		return defaultVal
	}
	return parsed
}

type ctxKeyUserID struct{}
