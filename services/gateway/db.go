package main

import (
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

type User struct {
	ID          int64
	GitHubID    int64
	Login       string
	AccessToken string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func initDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	_, err = db.Exec(`
		create table if not exists users (
			id serial primary key,
			github_id bigint unique not null,
			login text not null,
			access_token text not null,
			created_at timestamptz default now(),
			updated_at timestamptz default now()
		);
	`)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func upsertUser(db *sql.DB, githubID int64, login, accessToken string) (int64, error) {
	var id int64
	err := db.QueryRow(`
		insert into users (github_id, login, access_token)
		values ($1, $2, $3)
		on conflict (github_id)
		do update set login = excluded.login, access_token = excluded.access_token, updated_at = now()
		returning id;
	`, githubID, login, accessToken).Scan(&id)
	return id, err
}

func getUserByID(db *sql.DB, id int64) (*User, error) {
	row := db.QueryRow(`
		select id, github_id, login, access_token, created_at, updated_at
		from users where id = $1
	`, id)
	user := &User{}
	err := row.Scan(&user.ID, &user.GitHubID, &user.Login, &user.AccessToken, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}
