# Multi-stage build for healthagg service
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy local dependencies first
COPY healthutil/ /app/healthutil/
COPY logging/ /app/logging/

# Copy service code
COPY healthagg/go.mod healthagg/go.sum ./
RUN go mod download

COPY healthagg/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /healthagg .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /healthagg /healthagg

EXPOSE 8091

ENTRYPOINT ["/healthagg"]
