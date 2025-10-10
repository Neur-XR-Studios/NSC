const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const VideoController = require('../controllers/VideoController');
const VideoValidator = require('../validator/VideoValidator');
const auth = require('../middlewares/auth');

const router = express.Router();

// Ensure directory exists
const storageDir = path.join(__dirname, '..', 'public', 'video');
fs.mkdirSync(storageDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname || '');
    cb(null, `${timestamp}${ext}`);
  },
});

const upload = multer({ storage });

const controller = new VideoController();
const validator = new VideoValidator();

// Create (admin only)
router.post('/', auth(['admin']), upload.single('video'), validator.createValidator, controller.create);

// List (public or authenticated based on your needs) - leaving open
router.get('/', controller.list);

// Get single
router.get('/:id', controller.get);

// Update (admin only) - optional new file
router.put('/:id', auth(['admin']), upload.single('video'), validator.updateValidator, controller.update);

// Delete (admin only)
router.delete('/:id', auth(['admin']), controller.remove);

module.exports = router;
