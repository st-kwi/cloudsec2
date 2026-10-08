# Dockerfile for Web Tier (Nginx Reverse Proxy)
FROM nginx:alpine

# Copy custom hardened configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend code
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
