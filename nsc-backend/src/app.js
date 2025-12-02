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
    
    // In development, allow all origins for testing
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.length === 0) {
      // If not configured, default to reflecting the request origin (use cautiously in dev)
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

// Sync database model - alter: true will update column sizes automatically
db.sequelize
  .sync({ alter: true })
  .then(async () => {
    console.log('Database synced successfully');
    // ensure there is at least one admin user
    const userService = new UserService();
    await userService.ensureAdminExists();
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Sequelize sync error:', e);
  });

module.exports = app;
