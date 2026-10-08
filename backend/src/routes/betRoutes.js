const express = require('express');
const router = express.Router();
const betController = require('../controllers/betController');
const { authenticateToken } = require('../middleware/auth');
const { bettingLimiter } = require('../middleware/rateLimiter');

// All betting actions require authenticated user
router.post('/place', authenticateToken, bettingLimiter, betController.placeBet);
router.get('/my-history', authenticateToken, betController.getUserBets);

module.exports = router;
