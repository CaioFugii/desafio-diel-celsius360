# Build context: raiz do monorepo (precisa do pnpm-lock.yaml do workspace).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter backend...
COPY backend backend
RUN pnpm --filter backend build \
 && pnpm --filter backend deploy --prod /out \
 && cp -r backend/dist backend/migrations /out/

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/database/migrate.js && exec node dist/main.js"]
