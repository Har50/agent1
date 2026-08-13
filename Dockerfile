# Fastify execution service (dev / default)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/server.js"]
