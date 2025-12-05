#!/bin/sh
set -e

echo "=========================================="
echo "🚀 NSC Backend Docker Entrypoint"
echo "=========================================="

# Wait for database to be ready (if DB_HOST is set)
if [ -n "$DB_HOST" ]; then
  echo "⏳ Waiting for database at $DB_HOST:${DB_PORT:-3306}..."
  
  # Simple wait loop - try to connect for up to 30 seconds
  RETRIES=30
  until nc -z "$DB_HOST" "${DB_PORT:-3306}" 2>/dev/null || [ $RETRIES -eq 0 ]; do
    echo "   Waiting for database... ($RETRIES retries left)"
    RETRIES=$((RETRIES-1))
    sleep 1
  done
  
  if [ $RETRIES -eq 0 ]; then
    echo "❌ Could not connect to database after 30 seconds"
    echo "   Continuing anyway - migrations may fail"
  else
    echo "✅ Database is ready!"
    # Give it a moment to fully initialize
    sleep 2
  fi
fi

# Run database migrations
echo ""
echo "📦 Running database migrations..."
echo "----------------------------------------"

# Check migration status first
echo "📋 Current migration status:"
npx sequelize-cli db:migrate:status 2>&1 || echo "   (Could not get status - database may not be initialized)"

echo ""
echo "🔄 Applying pending migrations..."
if npx sequelize-cli db:migrate; then
  echo "✅ Migrations completed successfully!"
else
  echo "⚠️  Migration failed or no migrations to run"
  echo "   The app will continue to start..."
fi

# Run database seeds (only inserts if data doesn't exist)
echo ""
echo "🌱 Running database seeds..."
if npx sequelize-cli db:seed:all 2>&1; then
  echo "✅ Seeds completed successfully!"
else
  echo "⚠️  Seeds failed or already seeded"
  echo "   The app will continue to start..."
fi

echo ""
echo "----------------------------------------"
echo "🎯 Starting NSC Backend Server..."
echo "=========================================="

# Execute the main command (node src/index.js)
exec "$@"
