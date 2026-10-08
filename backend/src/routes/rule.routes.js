const express = require('express');
const router = express.Router();
const RuleController = require('../controllers/rule.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validators');

router.use(authenticateToken);

// All authenticated users can view active rules (e.g., to know office timings)
router.get('/', RuleController.getRules);

// Only Admin can update attendance policy rules
router.put('/', authorizeRoles('ADMIN'), validate(V.updateRules), RuleController.updateRules);

module.exports = router;
