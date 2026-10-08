const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validators');

router.use(authenticateToken);

// HR and Admin can view users list
router.get('/', authorizeRoles('HR', 'ADMIN'), validate(V.listUsers), UserController.getAllUsers);

// Only Admin can create, update, and toggle users
router.post('/', authorizeRoles('ADMIN'), validate(V.createUser), UserController.createUser);
router.put('/:id', authorizeRoles('ADMIN'), validate(V.updateUser), UserController.updateUser);
router.patch('/:id/toggle-status', authorizeRoles('ADMIN'), validate(V.userIdParam), UserController.toggleUserStatus);

module.exports = router;
