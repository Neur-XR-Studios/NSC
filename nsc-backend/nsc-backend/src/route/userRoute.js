const express = require('express');
const auth = require('../middlewares/auth');
const UserController = require('../controllers/UserController');
const UserValidator = require('../validator/UserValidator');

const router = express.Router();

const controller = new UserController();
const validator = new UserValidator();

// Create user (admin only)
router.post('/', auth(['admin']), validator.createValidator, controller.create);

// List users (admin only)
router.get('/', auth(['admin']), controller.list);

// Get current user profile (authenticated users)
router.get('/profile', auth(['admin', 'user']), controller.getProfile);

// Update current user profile (authenticated users)
router.patch('/profile', auth(['admin', 'user']), validator.updateProfileValidator, controller.updateProfile);

// Get user by ID (admin only)
router.get('/:id', auth(['admin']), controller.get);

// Update user by ID (admin only) - supports partial updates including role and status
router.patch('/:id', auth(['admin']), validator.updateValidator, controller.update);

// Delete user by ID (admin only)
router.delete('/:id', auth(['admin']), controller.remove);

module.exports = router;
