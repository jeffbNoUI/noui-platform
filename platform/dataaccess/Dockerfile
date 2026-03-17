# Multi-stage build for dataaccess service
# Context: ./platform (parent directory, so replace directives resolve correctly)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy shared packages (required by replace directives in go.mod)
COPY auth/ auth/
COPY dbcontext/ dbcontext/
COPY envutil/ envutil/
COPY healthutil/ healthutil/
COPY logging/ logging/
COPY ratelimit/ ratelimit/
COPY validation/ validation/

# Copy service
COPY dataaccess/ dataaccess/

WORKDIR /app/dataaccess
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /dataaccess .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /dataaccess /dataaccess

EXPOSE 8081

ENTRYPOINT ["/dataaccess"]
