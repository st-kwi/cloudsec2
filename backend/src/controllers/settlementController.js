const db = require('../config/db');

exports.settleMatch = async (req, res) => {
    try {
        const { matchId, result, scoreHome = 0, scoreAway = 0 } = req.body;

        if (!matchId || !['home', 'draw', 'away'].includes(result)) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ matchId และผลการแข่งขันที่ถูกต้อง (home, draw, away)'
            });
        }

        const settlementSummary = await db.settleMatchAndPayout(
            matchId,
            result,
            parseInt(scoreHome, 10),
            parseInt(scoreAway, 10)
        );

        res.json({
            success: true,
            message: `สรุปผลการแข่งขันคู่ ${matchId} สำเร็จ (ผล: ${result}) พร้อมปรับสถานะโพยและโอนแต้มรางวัลอัตโนมัติ`,
            settlementSummary
        });
    } catch (err) {
        console.error('Settlement error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
