const db = require('../config/db');

exports.getMatches = async (req, res) => {
    try {
        const { sport, status } = req.query;
        let matches = await db.getAllMatches();

        if (sport && sport !== 'all') {
            matches = matches.filter(m => m.sport.toLowerCase() === sport.toLowerCase());
        }

        if (status && status !== 'all') {
            matches = matches.filter(m => m.status.toLowerCase() === status.toLowerCase());
        }

        res.json({
            success: true,
            count: matches.length,
            data: matches
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.addMatch = async (req, res) => {
    try {
        const { sport, league, home_team, away_team, odds_home, odds_draw, odds_away, match_time } = req.body;

        if (!home_team || !away_team) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อทีมเหย้าและทีมเยือน' });
        }

        const newMatch = await db.addMatch({
            sport: sport || 'football',
            league: league || 'League Match',
            home_team,
            away_team,
            odds_home: odds_home || 1.90,
            odds_draw: odds_draw || 3.20,
            odds_away: odds_away || 2.80,
            match_time: match_time || 'เร็วๆ นี้',
            is_external_feed: false
        });

        res.status(201).json({
            success: true,
            message: 'เพิ่มคู่แข่งขันสำเร็จ (ดำเนินการโดย App Tier Operator)',
            data: newMatch
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Simulate Outgoing Egress Connection via AWS NAT Gateway
 * Demonstrates: App Tier in Private Subnet making outgoing request to External Sports Feed Provider
 * without exposing App Tier to inbound internet connections.
 */
exports.syncExternalFeed = async (req, res) => {
    try {
        // Mock external sports feed provider payload received via NAT Gateway
        const mockExternalFeeds = [
            {
                id: `feed-${Date.now()}-1`,
                sport: 'football',
                league: 'UEFA Champions League',
                home_team: 'บาเยิร์น มิวนิค',
                away_team: 'ปารีส แซงต์-แชร์กแมง',
                home_logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
                away_logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
                status: 'upcoming',
                score_home: 0,
                score_away: 0,
                odds_home: 1.95,
                odds_draw: 3.60,
                odds_away: 3.25,
                match_time: 'คืนพรุ่งนี้ 02:00',
                is_external_feed: true
            },
            {
                id: `feed-${Date.now()}-2`,
                sport: 'basketball',
                league: 'NBA Western Finals',
                home_team: 'Denver Nuggets',
                away_team: 'Dallas Mavericks',
                home_logo: 'https://upload.wikimedia.org/wikipedia/en/7/76/Denver_Nuggets.svg',
                away_logo: 'https://upload.wikimedia.org/wikipedia/en/9/97/Dallas_Mavericks_logo.svg',
                status: 'upcoming',
                score_home: 0,
                score_away: 0,
                odds_home: 1.70,
                odds_draw: 11.50,
                odds_away: 2.15,
                match_time: 'มะรืนนี้ 08:30',
                is_external_feed: true
            }
        ];

        const inserted = [];
        for (const feed of mockExternalFeeds) {
            const m = await db.addMatch(feed);
            inserted.push(m);
        }

        res.json({
            success: true,
            message: 'ดึงข้อมูลคู่แข่งใหม่จาก External Sports Data Provider สำเร็จผ่าน AWS NAT Gateway',
            egressNetworkDetails: {
                sourceInstance: 'EC2 App Server (Private Subnet: 10.0.10.15)',
                routingTarget: 'NAT Gateway (Public Subnet: 10.0.1.50)',
                internetGateway: 'igw-01ab23 (Egress Only)',
                securityProof: 'App Tier ไม่มี Public IP และไม่รับ Inbound จากภายนอก 100%'
            },
            syncedMatches: inserted
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
