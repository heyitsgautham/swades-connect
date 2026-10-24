# Reproducible build and test environment for the extension.
#
#   docker build --target check .                 lint, typecheck, tests with coverage
#   docker build --target extension -o out .      writes the unpacked extension to ./out
#
# Chrome loads the result from disk, so there is no long-running service.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM deps AS check
RUN pnpm run lint && pnpm run typecheck && pnpm run test:coverage

FROM deps AS build
RUN pnpm run build

FROM scratch AS extension
COPY --from=build /app/dist/ /
