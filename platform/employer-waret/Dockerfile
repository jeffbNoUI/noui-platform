# Multi-stage build for employer-waret service
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
COPY employer-waret/ employer-waret/

WORKDIR /app/employer-waret
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /employer-waret .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /employer-waret /employer-waret

EXPOSE 8098

ENTRYPOINT ["/employer-waret"]
