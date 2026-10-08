const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/audit.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validators');

router.use(authenticateToken);

// Only Admin can view the system audit trail
router.get('/', authorizeRoles('ADMIN'), validate(V.auditLogs), AuditController.getLogs);

module.exports = router;
