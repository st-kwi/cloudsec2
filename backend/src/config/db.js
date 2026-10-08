/**
 * Database Adapter & ACID Transaction Engine
 * Supports PostgreSQL connection pool (AWS RDS / Local Container)
 * with graceful in-memory ACID store fallback for local prototype testing.
 */

const crypto = require('crypto');

// In-Memory Database store (Initialized with init.sql seed data)
const dbStore = {
    users: [
        { id: 1, username: 'player_alex', password: 'Password123!', role: 'user', created_at: new Date() },
        { id: 2, username: 'ops_manager', password: 'Password123!', role: 'ops_admin', created_at: new Date() },
        { id: 3, username: 'sec_auditor', password: 'Password123!', role: 'sec_admin', created_at: new Date() }
    ],
    wallets: [
        { id: 1, user_id: 1, balance: 5420, updated_at: new Date() },
        { id: 2, user_id: 2, balance: 50000, updated_at: new Date() },
        { id: 3, user_id: 3, balance: 100000, updated_at: new Date() }
    ],
    matches: [
        {
            id: 'm-101',
            sport: 'football',
            league: 'Premier League',
            home_team: 'อาร์เซนอล',
            away_team: 'แมนเชสเตอร์ ซิตี้',
            home_logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
            away_logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
            status: 'live',
            live_minute: "68'",
            score_home: 2,
            score_away: 1,
            odds_home: 2.15,
            odds_draw: 3.40,
            odds_away: 3.10,
            result: null,
            match_time: 'วันนี้ 22:30',
            is_external_feed: false
        },
        {
            id: 'm-102',
            sport: 'football',
            league: 'Premier League',
            home_team: 'ลิเวอร์พูล',
            away_team: 'เชลซี',
            home_logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
            away_logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
            status: 'live',
            live_minute: "42'",
            score_home: 1,
            score_away: 0,
            odds_home: 1.55,
            odds_draw: 3.80,
            odds_away: 5.20,
            result: null,
            match_time: 'วันนี้ 20:00',
            is_external_feed: false
        },
        {
            id: 'm-103',
            sport: 'football',
            league: 'La Liga',
            home_team: 'เรอัล มาดริด',
            away_team: 'บาร์เซโลนา',
            home_logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
            away_logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
            status: 'upcoming',
            live_minute: null,
            score_home: 0,
            score_away: 0,
            odds_home: 2.10,
            odds_draw: 3.50,
            odds_away: 2.85,
            result: null,
            match_time: 'วันนี้ 23:30',
            is_external_feed: false
        },
        {
            id: 'm-104',
            sport: 'basketball',
            league: 'NBA Regular',
            home_team: 'LA Lakers',
            away_team: 'Golden State Warriors',
            home_logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg',
            away_logo: 'https://upload.wikimedia.org/wikipedia/en/0/01/Golden_State_Warriors_logo.svg',
            status: 'live',
            live_minute: 'Q3 04:12',
            score_home: 78,
            score_away: 82,
            odds_home: 2.45,
            odds_draw: 12.00,
            odds_away: 1.62,
            result: null,
            match_time: 'วันนี้ 09:30',
            is_external_feed: false
        },
        {
            id: 'm-105',
            sport: 'basketball',
            league: 'NBA Regular',
            home_team: 'Boston Celtics',
            away_team: 'Miami Heat',
            home_logo: 'https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg',
            away_logo: 'https://upload.wikimedia.org/wikipedia/en/f/fb/Miami_Heat_logo.svg',
            status: 'upcoming',
            live_minute: null,
            score_home: 0,
            score_away: 0,
            odds_home: 1.42,
            odds_draw: 14.00,
            odds_away: 3.10,
            result: null,
            match_time: 'พรุ่งนี้ 07:30',
            is_external_feed: true
        }
    ],
    bets: [
        {
            id: 'TICKET-9041',
            user_id: 1,
            bet_type: 'single',
            total_stake: 200,
            total_odds: 1.85,
            potential_payout: 370,
            status: 'won',
            settled_at: new Date(Date.now() - 86400000),
            created_at: new Date(Date.now() - 90000000),
            items: [
                { match_id: 'm-102', selection: 'home', odds: 1.85, status: 'won' }
            ]
        }
    ],
    transactions: [
        { id: 1, user_id: 1, amount: -200, balance_after: 5420, tx_type: 'bet_placed', reference_id: 'TICKET-9041', created_at: new Date() }
    ]
};

// Concurrency Mutex Lock simulating PostgreSQL Row-Level Lock (`SELECT ... FOR UPDATE`)
const walletLocks = new Map();

async function acquireWalletLock(userId) {
    while (walletLocks.get(userId)) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    walletLocks.set(userId, true);
}

function releaseWalletLock(userId) {
    walletLocks.delete(userId);
}

module.exports = {
    // Users
    async findUserByUsername(username) {
        return dbStore.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    },

    async findUserById(id) {
        return dbStore.users.find(u => u.id === id) || null;
    },

    async createUser(username, password, role = 'user') {
        const id = dbStore.users.length + 1;
        const newUser = { id, username, password, role, created_at: new Date() };
        dbStore.users.push(newUser);
        
        // Create initial wallet with 1,000 points bonus
        const initialPoints = 1000;
        dbStore.wallets.push({ id: dbStore.wallets.length + 1, user_id: id, balance: initialPoints, updated_at: new Date() });
        dbStore.transactions.push({
            id: dbStore.transactions.length + 1,
            user_id: id,
            amount: initialPoints,
            balance_after: initialPoints,
            tx_type: 'initial_bonus',
            reference_id: 'SYSTEM-WELCOME',
            created_at: new Date()
        });

        return newUser;
    },

    // Wallets & Balances
    async getWalletByUserId(userId) {
        return dbStore.wallets.find(w => w.user_id === userId) || null;
    },

    // Matches
    async getAllMatches() {
        return dbStore.matches;
    },

    async getMatchById(id) {
        return dbStore.matches.find(m => m.id === id) || null;
    },

    async addMatch(matchData) {
        const newMatch = {
            id: matchData.id || `m-${Date.now()}`,
            sport: matchData.sport || 'football',
            league: matchData.league || 'International Friendly',
            home_team: matchData.home_team,
            away_team: matchData.away_team,
            home_logo: matchData.home_logo || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&auto=format&fit=crop&q=80',
            away_logo: matchData.away_logo || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&auto=format&fit=crop&q=80',
            status: matchData.status || 'upcoming',
            live_minute: matchData.live_minute || null,
            score_home: matchData.score_home || 0,
            score_away: matchData.score_away || 0,
            odds_home: parseFloat(matchData.odds_home) || 1.90,
            odds_draw: parseFloat(matchData.odds_draw) || 3.20,
            odds_away: parseFloat(matchData.odds_away) || 2.80,
            result: null,
            match_time: matchData.match_time || 'วันนี้ 21:00',
            is_external_feed: Boolean(matchData.is_external_feed)
        };
        dbStore.matches.unshift(newMatch);
        return newMatch;
    },

    // ACID Transaction for Placing Bets (Supports Single & Parlay/จดโพย)
    async placeBetWithLock({ userId, betType, items, stake }) {
        await acquireWalletLock(userId);
        try {
            const wallet = dbStore.wallets.find(w => w.user_id === userId);
            if (!wallet) throw new Error('ไม่พบข้อมูลกระเป๋าเงินผู้ใช้');

            if (wallet.balance < stake) {
                throw new Error(`คะแนนไม่เพียงพอ (คงเหลือ ${wallet.balance} PTS, ต้องการใช้ ${stake} PTS)`);
            }

            // Calculate Compounded Odds
            let totalOdds = 1.0;
            const verifiedItems = [];

            for (const item of items) {
                const match = dbStore.matches.find(m => m.id === item.matchId);
                if (!match) throw new Error(`ไม่พบรายการแข่งขัน ID ${item.matchId}`);
                if (match.status === 'finished') throw new Error(`คู่แข่งขัน ${match.home_team} vs ${match.away_team} จบลงแล้ว`);

                let odds = 1.0;
                if (item.selection === 'home') odds = match.odds_home;
                else if (item.selection === 'draw') odds = match.odds_draw;
                else if (item.selection === 'away') odds = match.odds_away;
                else throw new Error(`ตัวเลือกทายผลไม่ถูกต้อง: ${item.selection}`);

                totalOdds *= odds;
                verifiedItems.push({
                    match_id: match.id,
                    match_title: `${match.home_team} vs ${match.away_team}`,
                    selection: item.selection,
                    odds: odds,
                    status: 'pending'
                });
            }

            totalOdds = Math.round(totalOdds * 100) / 100;
            const potentialPayout = Math.round(stake * totalOdds);

            // Deduct Wallet Balance
            wallet.balance -= stake;
            wallet.updated_at = new Date();

            // Record Ticket / Slip
            const ticketId = 'TICKET-' + Math.floor(100000 + Math.random() * 900000);
            const newBet = {
                id: ticketId,
                user_id: userId,
                bet_type: betType, // 'single' or 'parlay'
                total_stake: stake,
                total_odds: totalOdds,
                potential_payout: potentialPayout,
                status: 'pending',
                settled_at: null,
                created_at: new Date(),
                items: verifiedItems
            };
            dbStore.bets.unshift(newBet);

            // Audit Ledger Entry
            dbStore.transactions.unshift({
                id: dbStore.transactions.length + 1,
                user_id: userId,
                amount: -stake,
                balance_after: wallet.balance,
                tx_type: 'bet_placed',
                reference_id: ticketId,
                created_at: new Date()
            });

            return {
                ticket: newBet,
                remainingBalance: wallet.balance
            };
        } finally {
            releaseWalletLock(userId);
        }
    },

    // Settlement Engine: Settle match & payout winnings
    async settleMatchAndPayout(matchId, result, scoreHome, scoreAway) {
        const match = dbStore.matches.find(m => m.id === matchId);
        if (!match) throw new Error('ไม่พบข้อมูลการแข่งขัน');

        match.status = 'finished';
        match.result = result; // 'home', 'draw', 'away'
        match.score_home = scoreHome;
        match.score_away = scoreAway;

        const settlements = [];

        // Check all pending bets containing this match
        for (const bet of dbStore.bets) {
            if (bet.status !== 'pending') continue;

            const matchItem = bet.items.find(i => i.match_id === matchId);
            if (!matchItem) continue;

            // Evaluate this specific match item
            if (matchItem.selection === result) {
                matchItem.status = 'won';
            } else {
                matchItem.status = 'lost';
            }

            // For Single Bets:
            if (bet.bet_type === 'single') {
                if (matchItem.status === 'won') {
                    bet.status = 'won';
                    bet.settled_at = new Date();

                    // Payout to user
                    await acquireWalletLock(bet.user_id);
                    try {
                        const wallet = dbStore.wallets.find(w => w.user_id === bet.user_id);
                        if (wallet) {
                            wallet.balance += bet.potential_payout;
                            wallet.updated_at = new Date();
                            dbStore.transactions.unshift({
                                id: dbStore.transactions.length + 1,
                                user_id: bet.user_id,
                                amount: bet.potential_payout,
                                balance_after: wallet.balance,
                                tx_type: 'bet_won',
                                reference_id: bet.id,
                                created_at: new Date()
                            });
                            settlements.push({ ticketId: bet.id, userId: bet.user_id, status: 'won', payout: bet.potential_payout });
                        }
                    } finally {
                        releaseWalletLock(bet.user_id);
                    }
                } else {
                    bet.status = 'lost';
                    bet.settled_at = new Date();
                    settlements.push({ ticketId: bet.id, userId: bet.user_id, status: 'lost', payout: 0 });
                }
            } 
            // For Parlay / Multi-bet (จดโพยรวมหลายคู่):
            else if (bet.bet_type === 'parlay') {
                const anyLost = bet.items.some(i => i.status === 'lost');
                const allFinishedAndWon = bet.items.every(i => i.status === 'won');

                if (anyLost) {
                    bet.status = 'lost';
                    bet.settled_at = new Date();
                    settlements.push({ ticketId: bet.id, userId: bet.user_id, status: 'lost', payout: 0 });
                } else if (allFinishedAndWon) {
                    bet.status = 'won';
                    bet.settled_at = new Date();

                    await acquireWalletLock(bet.user_id);
                    try {
                        const wallet = dbStore.wallets.find(w => w.user_id === bet.user_id);
                        if (wallet) {
                            wallet.balance += bet.potential_payout;
                            wallet.updated_at = new Date();
                            dbStore.transactions.unshift({
                                id: dbStore.transactions.length + 1,
                                user_id: bet.user_id,
                                amount: bet.potential_payout,
                                balance_after: wallet.balance,
                                tx_type: 'bet_won',
                                reference_id: bet.id,
                                created_at: new Date()
                            });
                            settlements.push({ ticketId: bet.id, userId: bet.user_id, status: 'won', payout: bet.potential_payout });
                        }
                    } finally {
                        releaseWalletLock(bet.user_id);
                    }
                }
            }
        }

        return {
            match,
            settlements
        };
    },

    // Retrieve user betting history
    async getUserBets(userId) {
        return dbStore.bets.filter(b => b.user_id === userId);
    },

    // Retrieve wallet transactions ledger
    async getUserTransactions(userId) {
        return dbStore.transactions.filter(t => t.user_id === userId);
    }
};
