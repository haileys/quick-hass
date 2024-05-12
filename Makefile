.PHONY: build
build: node_modules
	node_modules/.bin/tsc --outDir dist

.PHONY: check
check: node_modules
	node_modules/.bin/tsc --noEmit

.PHONY: node_modules
node_modules: node_modules/.package-lock.json

node_modules/.package-lock.json: package.json package-lock.json
	npm install

