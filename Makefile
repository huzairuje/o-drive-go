.PHONY: all build test dev run clean

all: build

build:
	@./scripts/build.sh

test:
	@go test -v -race ./...

dev-ui:
	@cd ui && npm run dev

run:
	@./bin/odrive -addr :8090 -db "postgres://postgres:postgres@127.0.0.1:5432/odrive?sslmode=disable"

clean:
	@rm -rf bin/ out/ ui/out/ ui/.next/ data/
