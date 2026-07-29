FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY packages packages
COPY apps/server apps/server

# Install all dependencies and build server
RUN npm install
RUN npm run build -w @canvio/server

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY packages packages
COPY apps/server apps/server

# Install only production dependencies
RUN npm install --omit=dev

# Copy built server files
COPY --from=builder /app/apps/server/dist /app/apps/server/dist

ENV PORT=4001
ENV NODE_ENV=production
EXPOSE 4001

CMD ["npm", "run", "start:ws", "-w", "@canvio/server"]
