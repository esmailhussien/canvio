FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY packages packages
COPY apps/server apps/server

# Install all dependencies and build server from the lockfile
RUN npm ci
RUN npm run build -w @canvio/server

FROM node:20-alpine AS runner
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY packages packages
COPY apps/server apps/server

# Install only production dependencies, reproducibly
RUN npm ci --omit=dev

# Copy built server files
COPY --from=builder /app/apps/server/dist /app/apps/server/dist

# Run as the unprivileged `node` user shipped with the base image
USER node

ENV PORT=4001
ENV NODE_ENV=production
EXPOSE 4001

CMD ["npm", "run", "start:ws", "-w", "@canvio/server"]
