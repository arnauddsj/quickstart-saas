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
ARG VITE_SENTRY_DSN VITE_SENTRY_ENVIRONMENT VITE_GLITCHTIP_URL SOURCE_COMMIT
ARG SENTRY_URL SENTRY_ORG SENTRY_PROJECT
ENV VITE_SENTRY_RELEASE=$SOURCE_COMMIT
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
  pnpm --filter client build && test -z "$(find client/dist -name '*.map')"

FROM nginx:1.27-alpine
ENV API_UPSTREAM=server:3000
ENV GLITCHTIP_ORIGIN=
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM|GLITCHTIP_ORIGIN
COPY client/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/client/dist /usr/share/nginx/html
EXPOSE 80
