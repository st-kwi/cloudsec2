const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public route to view fixtures & live odds
router.get('/', matchController.getMatches);

// Protected routes (Only ops_admin and sec_admin can add matches or sync feeds)
router.post('/', authenticateToken, requireRole(['ops_admin', 'sec_admin']), matchController.addMatch);
router.post('/sync-external', authenticateToken, requireRole(['ops_admin', 'sec_admin']), matchController.syncExternalFeed);

module.exports = router;
