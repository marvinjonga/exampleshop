FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build ./build

USER node

ARG SERVICE
ENV SERVICE=${SERVICE}

EXPOSE 8081

CMD node build/microservices/${SERVICE}/server.js