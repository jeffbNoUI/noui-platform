# Multi-stage build for connector service
FROM golang:1.26-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /connector ./service

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /connector /connector

EXPOSE 8090

ENTRYPOINT ["/connector"]
