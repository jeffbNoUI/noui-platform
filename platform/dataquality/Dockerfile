FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /dq-service .

FROM gcr.io/distroless/static-debian12

COPY --from=builder /dq-service /dq-service

EXPOSE 8086

ENTRYPOINT ["/dq-service"]
