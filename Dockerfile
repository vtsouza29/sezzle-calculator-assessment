FROM node:26-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.27-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=api /server /server
COPY --from=web /web/dist /web
ENV STATIC_DIR=/web PORT=8080
EXPOSE 8080
ENTRYPOINT ["/server"]
