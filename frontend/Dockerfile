# Stage 1: Build the React application
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build for production
RUN npm run build

# Stage 2: Serve the application with NGINX
FROM nginx:alpine

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (to be mapped in docker-compose)
EXPOSE 80

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
