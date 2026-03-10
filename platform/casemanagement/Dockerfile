FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /casemanagement .

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /casemanagement /casemanagement

EXPOSE 8088

ENTRYPOINT ["/casemanagement"]
