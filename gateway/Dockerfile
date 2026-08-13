FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
COPY main.go ./
COPY middleware ./middleware
RUN go mod download && CGO_ENABLED=0 go build -o /gateway .

FROM alpine:3.20
COPY --from=build /gateway /usr/local/bin/gateway
EXPOSE 8080
ENTRYPOINT ["gateway"]
