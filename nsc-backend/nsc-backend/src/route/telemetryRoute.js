const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const TelemetryController = require('../controllers/TelemetryController');
const TelemetryValidator = require('../validator/TelemetryValidator');
const auth = require('../middlewares/auth');

const router = express.Router();

const storageDir = path.join(__dirname, '..', 'public', 'telemetry');
fs.mkdirSync(storageDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname || '') || '.json';
    cb(null, `${timestamp}${ext}`);
  },
});

// Accept only JSON
const fileFilter = (req, file, cb) => {
  if ((file.mimetype && file.mimetype.includes('json')) || file.originalname.endsWith('.json')) {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed'));
  }
};

const upload = multer({ storage, fileFilter });

const controller = new TelemetryController();
const validator = new TelemetryValidator();

// Create (admin only)
router.post('/', auth(['admin']), upload.single('telemetry'), validator.createValidator, controller.create);

// List
router.get('/', controller.list);

// Get single
router.get('/:id', controller.get);

// Update (admin only)
router.put('/:id', auth(['admin']), upload.single('telemetry'), validator.updateValidator, controller.update);

// Delete (admin only)
router.delete('/:id', auth(['admin']), controller.remove);

module.exports = router;
