FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static files to nginx html directory
COPY . /usr/share/nginx/html

# Remove unnecessary files from the container
RUN rm -f /usr/share/nginx/html/Dockerfile \
    && rm -f /usr/share/nginx/html/nginx.conf \
    && rm -rf /usr/share/nginx/html/.git

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
