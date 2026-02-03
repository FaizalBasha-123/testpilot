# Git App Backend (Hackathon Demo)

## Endpoints
- `GET /auth/login`
- `GET /auth/callback`
- `POST /webhooks/github`
- `GET /api/repos` (Bearer JWT)

## Notes
- Uses GitHub OAuth for user login.
- Uses GitHub App Installation token for webhook actions.
