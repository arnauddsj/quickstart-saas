# docs/deployment.md
# Build context is the repository root: docker build -f client/Dockerfile .
# The server sources are copied in so `vue-tsc -b` typechecks the AppRouter contract
# inside the image: a green image build proves the types, not only that Vite bundled.
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.27.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --filter client...
COPY server/tsconfig.json server/tsconfig.build.json server/
COPY server/src server/src
COPY client client
RUN pnpm --filter client build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=server:3000
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM
COPY client/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/client/dist /usr/share/nginx/html
EXPOSE 80
