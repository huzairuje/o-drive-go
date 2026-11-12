#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building Next.js UI Export..."
cd "$DIR/ui"
npm run build

echo "==> Embedding UI assets into Go webui/dist..."
rm -rf "$DIR/internal/webui/dist"/*
cp -r "$DIR/ui/out"/* "$DIR/internal/webui/dist/"

echo "==> Compiling standalone Go binary..."
cd "$DIR"
mkdir -p "$DIR/bin"
go build -ldflags="-s -w" -o "$DIR/bin/odrive" ./cmd/odrive

echo "==> Build complete: $DIR/bin/odrive"
