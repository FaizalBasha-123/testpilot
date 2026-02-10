# Build Stage
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o gateway .

# Run Stage
FROM alpine:latest
WORKDIR /app

COPY --from=builder /app/gateway .
# Copy static files if they exist (optional, but good practice for SPA)
COPY --from=builder /app/static ./static

EXPOSE 8001
CMD ["./gateway"]
