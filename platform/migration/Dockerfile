# Multi-stage build for migration service
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
COPY migration/ migration/

WORKDIR /app/migration
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /migration .

# Production image with Chromium for PDF rendering (chromedp)
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium && \
    rm -rf /var/lib/apt/lists/*

# chromedp uses this env var to locate the Chrome binary.
ENV CHROME_PATH=/usr/bin/chromium

# Run as non-root user.
RUN useradd -r -s /bin/false appuser
USER appuser

COPY --from=builder /migration /migration

EXPOSE 8100

ENTRYPOINT ["/migration"]
