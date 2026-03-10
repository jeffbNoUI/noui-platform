# Multi-stage build for crm service
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /crm .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /crm /crm

EXPOSE 8083

ENTRYPOINT ["/crm"]
