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

// Admin can create any user; HR can create EMPLOYEE users
router.post('/', authorizeRoles('ADMIN', 'HR'), validate(V.createUser), UserController.createUser);
router.put('/:id', authorizeRoles('ADMIN'), validate(V.updateUser), UserController.updateUser);
router.patch('/:id/toggle-status', authorizeRoles('ADMIN'), validate(V.userIdParam), UserController.toggleUserStatus);

module.exports = router;
