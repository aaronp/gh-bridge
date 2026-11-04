.PHONY: install dev build test typecheck clean

install:
	bun install

dev: install
	bun run vite --port 5175

build:
	bun run vite build

test:
	bun test src

typecheck:
	bun run tsc --noEmit -p .

clean:
	rm -rf dist node_modules
