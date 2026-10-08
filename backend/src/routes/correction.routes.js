const express = require('express');
const router = express.Router();
const CorrectionController = require('../controllers/correction.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validators');

router.use(authenticateToken);

// Employee can submit & view
router.post('/', validate(V.createCorrection), CorrectionController.createRequest);
router.get('/', validate(V.listCorrections), CorrectionController.getRequests);

// HR and Admin can approve or reject
router.patch('/:id/review', authorizeRoles('HR', 'ADMIN'), validate(V.reviewCorrection), CorrectionController.reviewRequest);

module.exports = router;
