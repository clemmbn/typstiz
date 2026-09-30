# Production image for Coolify (or any Docker host).
# Stage 1 builds the static bundle with Node; stage 2 serves dist/ with nginx.
# The final image contains no Node and no node_modules.

# Keep in sync with node-version in .github/workflows/ci.yml.
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first so this layer stays cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Precompress text and WASM assets once at build time; nginx serves the .gz via gzip_static
# instead of recompressing the ~28 MB compiler WASM on every request.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.wasm' -o -name '*.otf' \) \
      -exec gzip -9 -k {} \;

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
