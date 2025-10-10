const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AudioTrackController = require('../controllers/AudioTrackController');
const AudioTrackValidator = require('../validator/AudioTrackValidator');
const auth = require('../middlewares/auth');

const router = express.Router();

// Ensure directory exists
const storageDir = path.join(__dirname, '..', 'public', 'audio');
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

// Accept only certain audio types
const allowedAudioExt = new Set(['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a']);
const allowedAudioMime = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);

const fileFilter = (req, file, cb) => {
  const ext = (path.extname(file.originalname || '') || '').toLowerCase();
  const ok = allowedAudioExt.has(ext) || allowedAudioMime.has((file.mimetype || '').toLowerCase());
  if (!ok) {
    // Do not throw, mark request invalid and continue; we'll return 400 later.
    req.fileValidationError = 'Only audio files are allowed (mp3, wav, aac, flac, ogg, m4a)';
    return cb(null, false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

// If file validation failed in fileFilter, return 400 instead of 500
const rejectIfInvalidAudio = (req, res, next) => {
  if (req.fileValidationError) {
    return res.status(400).send({ code: 400, message: req.fileValidationError });
  }
  next();
};

const controller = new AudioTrackController();
const validator = new AudioTrackValidator();

router.post('/', auth(['admin']), upload.single('audio'), rejectIfInvalidAudio, validator.createValidator, controller.create);

// List (optional filter by video_id)
router.get('/', controller.list);

// Get single
router.get('/:id', controller.get);

// Update (admin only) - optional new file
router.put('/:id', auth(['admin']), upload.single('audio'), validator.updateValidator, controller.update);

// Delete (admin only)
router.delete('/:id', auth(['admin']), controller.remove);

module.exports = router;
