FROM node:20-alpine

WORKDIR /usr/src/app

# Install netcat for database connection check and dos2unix for line ending conversion
RUN apk add --no-cache netcat-openbsd dos2unix

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for sequelize-cli)
RUN npm install --no-audit --no-fund

# Copy application code
COPY . .

# Fix line endings (Windows CRLF -> Unix LF) and make executable
RUN dos2unix docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 5000

# Use entrypoint script to run migrations before starting the app
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
