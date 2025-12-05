const express = require('express');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const routes = require('./route');
const { jwtStrategy } = require('./config/passport');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./helper/ApiError');
const path = require('path');
const UserService = require('./service/UserService');

process.env.PWD = process.cwd();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser or same-origin requests (no origin)
    if (!origin) return callback(null, true);

    // If CORS_ORIGIN is not configured (empty), allow ALL origins
    // This is useful for LAN access where the IP may vary
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }

    // Otherwise check against the configured allowed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Also allow any origin from the same IP as PUBLIC_HOST
    const publicHost = process.env.PUBLIC_HOST || '';
    if (publicHost && origin.includes(publicHost)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length'],
};

// enable cors
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// serve static assets from src/public
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);
const db = require('./models');

/**
 * Run pending database migrations automatically on startup.
 * This ensures all schema changes are applied without manual intervention.
 */
const runMigrations = async () => {
  try {
    const { exec } = require('child_process');
    const path = require('path');
    const util = require('util');
    const execPromise = util.promisify(exec);

    console.log('[DB] Running pending migrations...');

    const { stdout, stderr } = await execPromise('npx sequelize-cli db:migrate', {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env }
    });

    if (stdout) console.log('[DB] Migration output:', stdout);
    if (stderr && !stderr.includes('No migrations')) console.warn('[DB] Migration warnings:', stderr);

    console.log('[DB] Migrations completed successfully');
  } catch (error) {
    // Migration errors are non-fatal - the app can still run
    console.warn('[DB] Migration warning:', error.message);
  }
};

/**
 * Apply critical schema fixes that migrations might miss.
 * This ensures device ID columns are large enough (VARCHAR(128)).
 */
const applySchemaFixes = async () => {
  try {
    console.log('[DB] Applying schema fixes...');

    // Fix device ID column sizes in session_participants
    await db.sequelize.query(`
      ALTER TABLE session_participants 
      MODIFY COLUMN vr_device_id VARCHAR(128),
      MODIFY COLUMN chair_device_id VARCHAR(128)
    `).catch(() => { });

    // Fix device ID column size in session_logs
    await db.sequelize.query(`
      ALTER TABLE session_logs 
      MODIFY COLUMN vr_device_id VARCHAR(128)
    `).catch(() => { });

    console.log('[DB] Schema fixes applied');
  } catch (e) {
    // Non-fatal
    console.warn('[DB] Schema fix warning:', e.message);
  }
};

// Initialize database on startup
(async () => {
  try {
    // Run migrations first
    await runMigrations();

    // Sync models (creates tables if missing, updates columns)
    await db.sequelize.sync({ alter: true });
    console.log('[DB] Database synced successfully');

    // Apply any schema fixes that sync might miss
    await applySchemaFixes();

    // Ensure admin user exists
    const userService = new UserService();
    await userService.ensureAdminExists();

    console.log('[DB] Database initialization complete');
  } catch (e) {
    console.error('[DB] Database initialization error:', e);
  }
})();

module.exports = app;
