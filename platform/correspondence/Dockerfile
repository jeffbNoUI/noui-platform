# Multi-stage build for correspondence service
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /correspondence .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /correspondence /correspondence

EXPOSE 8085

ENTRYPOINT ["/correspondence"]
