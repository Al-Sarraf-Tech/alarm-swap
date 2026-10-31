# syntax=docker/dockerfile:1

FROM node:22.21.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
ENV PATH_PREFIX=/
RUN npm run build

FROM alpine:3.22.2 AS runtime
RUN apk add --no-cache nginx nginx-mod-http-brotli wget \
    && mkdir -p /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi /usr/share/nginx/html \
    && chown -R nginx:nginx /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi /var/lib/nginx /var/log/nginx /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/_site /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html /var/log/nginx /var/lib/nginx \
    && nginx -t \
    && rm -f /tmp/nginx.pid
USER nginx
EXPOSE 8080
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
