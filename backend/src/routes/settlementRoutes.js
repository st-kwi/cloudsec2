const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Protected route (Only operators/admins can settle matches)
router.post('/settle-match', authenticateToken, requireRole(['ops_admin', 'sec_admin']), settlementController.settleMatch);

module.exports = router;
