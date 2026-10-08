const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const attendanceRoutes = require('./attendance.routes');
const correctionRoutes = require('./correction.routes');
const userRoutes = require('./user.routes');
const ruleRoutes = require('./rule.routes');
const auditRoutes = require('./audit.routes');

router.use('/auth', authRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/corrections', correctionRoutes);
router.use('/users', userRoutes);
router.use('/rules', ruleRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
