# Use Node Alpine base image
FROM node:23-alpine

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the service port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
