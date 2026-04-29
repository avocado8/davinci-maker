FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
ENV PORT=80
ENV API_URL=
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
CMD ["sh", "-c", "APP_API_URL=\"${API_URL:-$VITE_API_URL}\"; printf 'window.__APP_CONFIG__ = { API_URL: \"%s\" };\\n' \"$APP_API_URL\" > /usr/share/nginx/html/env.js && nginx -g 'daemon off;'"]
