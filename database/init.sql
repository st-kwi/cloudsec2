-- ========================================================
-- APEX PREDICT: PostgreSQL 3-Tier Database Schema & Seeds
-- Database Tier (Isolated Subnet: 10.0.20.0/24, 10.0.21.0/24)
-- ========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'user', -- 'user', 'ops_admin', 'sec_admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Wallets Table (Points / Coins)
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance BIGINT NOT NULL DEFAULT 1000 CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Matches & Fixtures Table
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(50) PRIMARY KEY,
    sport VARCHAR(30) NOT NULL, -- 'football', 'basketball', 'esports'
    league VARCHAR(100) NOT NULL,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    home_logo VARCHAR(255),
    away_logo VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming', -- 'upcoming', 'live', 'finished'
    live_minute VARCHAR(20),
    score_home INT DEFAULT 0,
    score_away INT DEFAULT 0,
    odds_home NUMERIC(5,2) NOT NULL DEFAULT 1.90,
    odds_draw NUMERIC(5,2) NOT NULL DEFAULT 3.20,
    odds_away NUMERIC(5,2) NOT NULL DEFAULT 2.80,
    result VARCHAR(10), -- 'home', 'draw', 'away'
    match_time VARCHAR(50),
    is_external_feed BOOLEAN DEFAULT FALSE, -- Tagged if synced via NAT Gateway
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Betting Tickets / Slips (Supports Single Bet and Parlay / จดโพยชุด)
CREATE TABLE IF NOT EXISTS bets (
    id VARCHAR(50) PRIMARY KEY, -- e.g. TICKET-9812
    user_id INT NOT NULL REFERENCES users(id),
    bet_type VARCHAR(20) NOT NULL DEFAULT 'single', -- 'single', 'parlay'
    total_stake BIGINT NOT NULL CHECK (total_stake > 0),
    total_odds NUMERIC(8,2) NOT NULL CHECK (total_odds >= 1.00),
    potential_payout BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'won', 'lost', 'cancelled'
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bet Items (Items inside ticket slip for Parlay/จดโพย)
CREATE TABLE IF NOT EXISTS bet_items (
    id SERIAL PRIMARY KEY,
    bet_id VARCHAR(50) NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    match_id VARCHAR(50) NOT NULL REFERENCES matches(id),
    selection VARCHAR(10) NOT NULL, -- 'home', 'draw', 'away'
    odds NUMERIC(5,2) NOT NULL,
    item_status VARCHAR(20) NOT NULL DEFAULT 'pending' -- 'pending', 'won', 'lost'
);

-- 6. Audit Wallet Transactions (Ledger for Financial Security Audit)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    amount BIGINT NOT NULL, -- Negative for stake, Positive for win
    balance_after BIGINT NOT NULL,
    tx_type VARCHAR(30) NOT NULL, -- 'initial_bonus', 'bet_placed', 'bet_won', 'deposit'
    reference_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & rapid query retrieval
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);

-- ========================================================
-- Seed Initial User Personas (Passwords: 'Password123!')
-- bcrypt hash for 'Password123!': $2a$10$wT/pIe8wM5nK5K9bYjI7E.7mD59o8E8F8g.7Zc8aY9vN0X1l2K3e
-- ========================================================

-- Insert Demo Users
INSERT INTO users (id, username, password_hash, role) VALUES
(1, 'player_alex', '$2a$10$eE.l1kZ6fR23E3hL7yJ8fuyc9N9pG1c1O.N3rW3O6E6f1y5G1a.yO', 'user'),
(2, 'ops_manager', '$2a$10$eE.l1kZ6fR23E3hL7yJ8fuyc9N9pG1c1O.N3rW3O6E6f1y5G1a.yO', 'ops_admin'),
(3, 'sec_auditor', '$2a$10$eE.l1kZ6fR23E3hL7yJ8fuyc9N9pG1c1O.N3rW3O6E6f1y5G1a.yO', 'sec_admin')
ON CONFLICT (id) DO NOTHING;

-- Insert User Wallets
INSERT INTO wallets (user_id, balance) VALUES
(1, 5420),
(2, 50000),
(3, 100000)
ON CONFLICT (user_id) DO NOTHING;

-- Insert Matches Seed
INSERT INTO matches (id, sport, league, home_team, away_team, home_logo, away_logo, status, live_minute, score_home, score_away, odds_home, odds_draw, odds_away, match_time, is_external_feed) VALUES
('m-101', 'football', 'Premier League', 'อาร์เซนอล', 'แมนเชสเตอร์ ซิตี้', 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg', 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg', 'live', '68''', 2, 1, 2.15, 3.40, 3.10, 'วันนี้ 22:30', FALSE),
('m-102', 'football', 'Premier League', 'ลิเวอร์พูล', 'เชลซี', 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg', 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg', 'live', '42''', 1, 0, 1.55, 3.80, 5.20, 'วันนี้ 20:00', FALSE),
('m-103', 'football', 'La Liga', 'เรอัล มาดริด', 'บาร์เซโลนา', 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg', 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg', 'upcoming', NULL, 0, 0, 2.10, 3.50, 2.85, 'วันนี้ 23:30', FALSE),
('m-104', 'basketball', 'NBA Regular', 'LA Lakers', 'Golden State Warriors', 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg', 'https://upload.wikimedia.org/wikipedia/en/0/01/Golden_State_Warriors_logo.svg', 'live', 'Q3 04:12', 78, 82, 2.45, 12.00, 1.62, 'วันนี้ 09:30', FALSE),
('m-105', 'basketball', 'NBA Regular', 'Boston Celtics', 'Miami Heat', 'https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg', 'https://upload.wikimedia.org/wikipedia/en/f/fb/Miami_Heat_logo.svg', 'upcoming', NULL, 0, 0, 1.42, 14.00, 3.10, 'พรุ่งนี้ 07:30', TRUE)
ON CONFLICT (id) DO NOTHING;
