FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=
ARG VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./public
EXPOSE 3000
CMD ["node", "server.js"]
