FROM node:22-bookworm-slim

# Install LibreOffice (writer + core) and Arabic-capable open fonts.
# fontconfig is required for LibreOffice to discover installed fonts at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-common \
    libreoffice-writer \
    fontconfig \
    fonts-noto-core \
    fonts-dejavu-core \
    fonts-liberation2 \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack so pnpm is available inside the image.
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy the full monorepo so workspace: links resolve correctly.
COPY . .

# Install all workspace dependencies (frozen lockfile for reproducible builds).
RUN pnpm install --frozen-lockfile

# Build the API package (esbuild bundles src → dist/index.mjs).
RUN pnpm --filter @workspace/api-server build

EXPOSE 3000

CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
