package main

import (
	"errors"
	"strconv"
)

func parseInt64(val string) (int64, error) {
	if val == "" {
		return 0, errors.New("empty value")
	}
	return strconv.ParseInt(val, 10, 64)
}

type ctxKeyUserID struct{}
