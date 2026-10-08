const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validators');

router.post('/login', validate(V.login), AuthController.login);
router.get('/me', authenticateToken, AuthController.getMe);
router.get('/demo-credentials', AuthController.getDemoCredentials);

module.exports = router;
