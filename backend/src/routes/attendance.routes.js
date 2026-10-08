const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendance.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const V = require('../validators');

router.use(authenticateToken);

// Clock in / out
router.post('/clock-in', validate(V.clock), AttendanceController.clockIn);
router.post('/clock-out', validate(V.clock), AttendanceController.clockOut);

// Status & Metrics
router.get('/today', AttendanceController.getTodayStatus);
router.get('/metrics', validate(V.metrics), AttendanceController.getMetrics);
router.get('/history', validate(V.history), AttendanceController.getHistory);

module.exports = router;
