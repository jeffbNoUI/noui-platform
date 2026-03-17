# Multi-stage build for casemanagement service
# Context: ./platform (parent directory, so replace directives resolve correctly)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy shared packages (required by replace directives in go.mod)
COPY auth/ auth/
COPY cache/ cache/
COPY dbcontext/ dbcontext/
COPY envutil/ envutil/
COPY healthutil/ healthutil/
COPY logging/ logging/
COPY ratelimit/ ratelimit/
COPY validation/ validation/

# Copy service
COPY casemanagement/ casemanagement/

WORKDIR /app/casemanagement
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /casemanagement .

# Distroless production image
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /casemanagement /casemanagement

EXPOSE 8088

ENTRYPOINT ["/casemanagement"]
