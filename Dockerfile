FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/app/data/sidebets.db

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
