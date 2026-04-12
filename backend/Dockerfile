FROM denoland/deno:2.3.1

WORKDIR /app

# Set DENO_DIR inside /app so the runtime write permission covers it
ENV DENO_DIR=/app/.deno-cache

# Cache dependencies at build time (baked into image layer)
# Note: Build context is repo root, so we copy from backend/ subdirectory
COPY backend/main.ts .
RUN deno cache main.ts

# Ensure data directory exists (will be replaced by Render persistent disk mount)
RUN mkdir -p /data

EXPOSE 8000

# Permissions:
#   --allow-net        serve HTTP and make no outbound calls
#   --allow-env        read PORT, HARBORWATCH_API_KEY, ALLOWED_ORIGIN, DB_PATH
#   --allow-read       read DB file and check /data exists
#   --allow-write=/data,/app   write DB to /data (prod) or /app (dev) + deno cache in /app/.deno-cache
CMD ["deno", "run", \
  "--allow-net", \
  "--allow-env", \
  "--allow-read", \
  "--allow-write=/data,/app", \
  "main.ts"]
