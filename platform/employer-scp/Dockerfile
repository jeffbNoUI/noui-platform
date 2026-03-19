# Multi-stage build for employer-scp service
# Context: ./platform (parent directory, so replace directives resolve correctly)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy shared packages (required by replace directives in go.mod)
COPY apiresponse/ apiresponse/
COPY auth/ auth/
COPY dbcontext/ dbcontext/
COPY employer-shared/ employer-shared/
COPY envutil/ envutil/
COPY healthutil/ healthutil/
COPY logging/ logging/
COPY ratelimit/ ratelimit/
COPY validation/ validation/

# Copy service
COPY employer-scp/ employer-scp/

WORKDIR /app/employer-scp
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /employer-scp .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /employer-scp /employer-scp

EXPOSE 8099

ENTRYPOINT ["/employer-scp"]
