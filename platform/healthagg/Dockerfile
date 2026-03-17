# Multi-stage build for healthagg service
# Context: ./platform (parent directory, so replace directives resolve correctly)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy shared packages (required by replace directives in go.mod)
COPY healthutil/ healthutil/
COPY logging/ logging/

# Copy service
COPY healthagg/ healthagg/

WORKDIR /app/healthagg
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /healthagg .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /healthagg /healthagg

EXPOSE 8091

ENTRYPOINT ["/healthagg"]
