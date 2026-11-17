.PHONY: test coverage dev-backend dev-frontend docker

test:
	cd backend && go test ./...
	cd frontend && npm test -- --run

coverage:
	mkdir -p docs/coverage/backend docs/coverage/frontend
	cd backend && go test -coverprofile=coverage.out ./... && \
		go tool cover -html=coverage.out -o ../docs/coverage/backend/coverage.html && \
		go tool cover -func=coverage.out > ../docs/coverage/backend/coverage.txt && \
		rm coverage.out
	cd frontend && npm run test:coverage
	cp -R frontend/coverage/. docs/coverage/frontend/

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend:
	cd frontend && npm run dev

docker:
	docker compose up --build
