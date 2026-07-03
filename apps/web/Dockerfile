ARG NODE_IMAGE=node:20-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/shared/package*.json packages/shared/
RUN npm config set registry ${NPM_REGISTRY} && npm ci
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build -w @fhjd-cf/shared && npm run build -w @fhjd-cf/web

FROM ${NGINX_IMAGE}
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
