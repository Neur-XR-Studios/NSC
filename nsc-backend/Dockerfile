FROM node:20-alpine

WORKDIR /usr/src/app

# Install netcat for database connection check
RUN apk add --no-cache netcat-openbsd

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for sequelize-cli)
RUN npm install --no-audit --no-fund

# Copy application code
COPY . .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 5000

# Use entrypoint script to run migrations before starting the app
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
