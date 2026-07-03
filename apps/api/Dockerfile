ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG DATABASE_URL=postgresql://fhjd_cf:change_me@postgres:5432/fhjd_cf_process?schema=public
ENV DATABASE_URL=${DATABASE_URL}
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/shared/package*.json packages/shared/
RUN npm config set registry ${NPM_REGISTRY} && npm ci
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run build -w @fhjd-cf/shared && npm run prisma:generate -w @fhjd-cf/api && npm run build -w @fhjd-cf/api

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/shared/package*.json packages/shared/
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/node_modules/ node_modules/
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /app/apps/api/tsconfig.json apps/api/tsconfig.json
COPY --from=build /app/apps/api/tsconfig.seed.json apps/api/tsconfig.seed.json
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
