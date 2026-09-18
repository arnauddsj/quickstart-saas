# docs/deployment.md
# Build context is the repository root: docker build -f server/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.27.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile --filter server...
COPY server server
RUN pnpm --filter server build && pnpm --filter server deploy --prod /out/server

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/server/node_modules ./node_modules
COPY --from=build --chown=node:node /out/server/package.json ./package.json
COPY --from=build --chown=node:node /repo/server/dist ./dist
COPY --from=build --chown=node:node /repo/server/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
