build:
    node esbuild.mjs

install:
    npm install

lint:
    npm run lint

watch:
    node esbuild.mjs --watch

clean:
    rm -rf ./node_modules ./lib
