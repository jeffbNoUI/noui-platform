# Multi-stage build for issues service
# Context: ./platform (parent directory, so replace directives resolve correctly)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy shared packages (required by replace directives in go.mod)
COPY apiresponse/ apiresponse/
COPY auth/ auth/
COPY dbcontext/ dbcontext/
COPY envutil/ envutil/
COPY healthutil/ healthutil/
COPY logging/ logging/
COPY ratelimit/ ratelimit/
COPY validation/ validation/

# Copy service
COPY issues/ issues/

WORKDIR /app/issues
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /issues .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /issues /issues

EXPOSE 8092

ENTRYPOINT ["/issues"]
