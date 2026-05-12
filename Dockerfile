# syntax=docker/dockerfile:1.7
# ---- Build stage ----
FROM node:26-bookworm-slim AS build
WORKDIR /app

# System deps required to build the `canvas` native module used by chartjs-node-canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      python3 \
      pkg-config \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
      libpixman-1-dev \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

# ---- Runtime stage ----
FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime libs for canvas + fonts (so non-ASCII labels render correctly)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libjpeg62-turbo \
      libgif7 \
      librsvg2-2 \
      libpixman-1-0 \
      fonts-dejavu-core \
      fonts-noto-core \
      fonts-noto-color-emoji \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY package.json ./

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
