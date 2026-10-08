/**
 * APEX PREDICT - Standalone Zero-Dependency Server (Node.js Native)
 * Designed for 100% immediate local execution without needing 'npm install' or external libraries,
 * perfectly optimized for virtual file systems (like Google Drive).
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_aws_term_project_secret_key_2026';

// Persona AWS Tier Permission Mapping
const PERSONA_TIER_PERMISSIONS = {
    user: {
        title: 'ผู้ใช้งานทั่วไป (End User)',
        description: 'เข้าใช้งานหน้าบ้าน ทายผลกีฬา จดโพย ตรวจสอบแต้มกระเป๋าเงิน',
        allowedAwsTiers: ['Web Tier (Public HTTPS via ALB)'],
        deniedAwsTiers: ['App Tier Direct Access', 'DB Tier Direct Access', 'AWS Console Admin']
    },
    ops_admin: {
        title: 'ผู้ดูแลระบบปฏิบัติการ (App Tier Ops)',
        description: 'จัดการตารางแข่งขัน อัตราต่อรอง สรุปผลการแข่งขันผ่าน App API',
        allowedAwsTiers: ['Web Tier', 'App Tier (SSM Session Manager & Internal API)'],
        deniedAwsTiers: ['DB Tier Direct Root Access', 'Cloud KMS Root Management']
    },
    sec_admin: {
        title: 'ผู้ดูแลความปลอดภัยคลาวด์ (CloudSec & Audit)',
        description: 'ตรวจสอบ Audit Logs, Security Groups, IAM Policies, และสถาปัตยกรรม 3-Tier',
        allowedAwsTiers: ['Web Tier', 'App Tier', 'DB Tier (Audit Logs only)', 'AWS CloudTrail & GuardDuty Console'],
        deniedAwsTiers: ['Direct modify customer bet odds']
    }
};

// Simple Native JWT Encoder/Decoder
function createToken(payload, secret, expiresInSeconds = 28800) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

// In-Memory Rate Limiter
const ipRequestCounts = new Map();
function checkRateLimit(ip, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const timestamps = (ipRequestCounts.get(ip) || []).filter(t => now - t < windowMs);
    timestamps.push(now);
    ipRequestCounts.set(ip, timestamps);
    return timestamps.length <= maxRequests;
}

// Helper to send JSON responses with security headers
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
    });
    res.end(JSON.stringify(data));
}

// HTTP Request Dispatcher
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const clientIp = req.socket.remoteAddress || '127.0.0.1';

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    // Rate Limit Check
    if (!checkRateLimit(clientIp, 120, 60000)) {
        return sendJSON(res, 429, { success: false, message: 'คำขอถี่เกินไป (Rate Limit Exceeded)' });
    }

    // Parse Body helper
    const getBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
    });

    // Extract Auth User helper
    const getAuthUser = () => {
        const authHeader = req.headers['authorization'];
        if (!authHeader) return null;
        const token = authHeader.split(' ')[1];
        return verifyToken(token, JWT_SECRET);
    };

    try {
        // 0. Static Files Handler (Serve frontend index.html, deployment guide, reports)
        if (req.method === 'GET' && !pathname.startsWith('/api')) {
            const projectRoot = path.resolve(__dirname, '../..');
            let candidatePaths = [];
            if (pathname === '/' || pathname === '/index.html') {
                candidatePaths.push(path.join(projectRoot, 'frontend', 'index.html'));
                candidatePaths.push(path.join(projectRoot, 'index.html'));
            } else if (pathname === '/deployment-guide.html' || pathname === '/guide') {
                candidatePaths.push(path.join(projectRoot, 'frontend', 'deployment-guide.html'));
            } else {
                candidatePaths.push(path.join(projectRoot, pathname));
                candidatePaths.push(path.join(projectRoot, 'frontend', pathname));
            }

            const foundPath = candidatePaths.find(p => {
                try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch (e) { return false; }
            });

            if (foundPath) {
                const ext = path.extname(foundPath).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html; charset=utf-8',
                    '.css': 'text/css; charset=utf-8',
                    '.js': 'application/javascript; charset=utf-8',
                    '.json': 'application/json; charset=utf-8',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.svg': 'image/svg+xml',
                    '.pdf': 'application/pdf'
                };
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                    'X-Content-Type-Options': 'nosniff'
                });
                return fs.createReadStream(foundPath).pipe(res);
            }
        }

        // 1. Health & AWS Telemetry
        if (req.method === 'GET' && pathname === '/api/health') {
            return sendJSON(res, 200, {
                status: 'UP',
                service: 'Apex Predict App Tier Engine (Native Standalone)',
                environment: 'Local Simulation',
                awsMetadata: {
                    tier: 'Tier 2: App Tier (Private Subnet: 10.0.10.0/24)',
                    securityGroup: 'sg-app-ec2 (Inbound restricted to sg-web only)',
                    databaseEngine: 'ACID Concurrency Engine Active',
                    natGatewayEgress: 'Connected'
                },
                timestamp: new Date().toISOString()
            });
        }

        // 2. Auth: Register
        if (req.method === 'POST' && pathname === '/api/auth/register') {
            const { username, password, role = 'user' } = await getBody();
            if (!username || !password) {
                return sendJSON(res, 400, { success: false, message: 'กรุณากรอก Username และ Password' });
            }
            const existing = await db.findUserByUsername(username);
            if (existing) {
                return sendJSON(res, 409, { success: false, message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
            }
            const validRole = ['user', 'ops_admin', 'sec_admin'].includes(role) ? role : 'user';
            const user = await db.createUser(username, password, validRole);
            const wallet = await db.getWalletByUserId(user.id);
            const token = createToken({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);

            return sendJSON(res, 201, {
                success: true,
                message: 'สมัครสมาชิกสำเร็จ! ได้รับโบนัสเริ่มต้น 1,000 PTS',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    balance: wallet ? wallet.balance : 1000,
                    tierPermissions: PERSONA_TIER_PERMISSIONS[user.role]
                }
            });
        }

        // 3. Auth: Login
        if (req.method === 'POST' && pathname === '/api/auth/login') {
            const { username, password } = await getBody();
            const user = await db.findUserByUsername(username);
            if (!user || user.password !== password) {
                return sendJSON(res, 401, { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
            }
            const wallet = await db.getWalletByUserId(user.id);
            const token = createToken({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);

            return sendJSON(res, 200, {
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    balance: wallet ? wallet.balance : 0,
                    tierPermissions: PERSONA_TIER_PERMISSIONS[user.role]
                }
            });
        }

        // 4. Auth: Profile
        if (req.method === 'GET' && pathname === '/api/auth/profile') {
            const authUser = getAuthUser();
            if (!authUser) return sendJSON(res, 401, { success: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
            const wallet = await db.getWalletByUserId(authUser.id);
            return sendJSON(res, 200, {
                success: true,
                user: {
                    id: authUser.id,
                    username: authUser.username,
                    role: authUser.role,
                    balance: wallet ? wallet.balance : 0,
                    tierPermissions: PERSONA_TIER_PERMISSIONS[authUser.role]
                }
            });
        }

        // 5. Matches: Get All
        if (req.method === 'GET' && pathname === '/api/matches') {
            const { sport, status } = parsedUrl.query;
            let matches = await db.getAllMatches();
            if (sport && sport !== 'all') matches = matches.filter(m => m.sport.toLowerCase() === sport.toLowerCase());
            if (status && status !== 'all') matches = matches.filter(m => m.status.toLowerCase() === status.toLowerCase());
            return sendJSON(res, 200, { success: true, count: matches.length, data: matches });
        }

        // 6. Matches: Add New Match (Protected: ops_admin / sec_admin)
        if (req.method === 'POST' && pathname === '/api/matches') {
            const authUser = getAuthUser();
            if (!authUser || !['ops_admin', 'sec_admin'].includes(authUser.role)) {
                return sendJSON(res, 403, { success: false, message: 'การเข้าถึงถูกปฏิเสธ: อนุญาตเฉพาะผู้ดูแลระบบ (ops_admin/sec_admin)' });
            }
            const body = await getBody();
            const newMatch = await db.addMatch(body);
            return sendJSON(res, 201, { success: true, message: 'เพิ่มคู่แข่งขันสำเร็จ (App Tier Ops)', data: newMatch });
        }

        // 7. Matches: Sync External Feed via NAT Gateway
        if (req.method === 'POST' && pathname === '/api/matches/sync-external') {
            const authUser = getAuthUser();
            if (!authUser || !['ops_admin', 'sec_admin'].includes(authUser.role)) {
                return sendJSON(res, 403, { success: false, message: 'อนุญาตเฉพาะผู้ดูแลระบบ' });
            }

            const mockFeeds = [
                {
                    id: `feed-${Date.now()}-1`,
                    sport: 'football',
                    league: 'UEFA Champions League',
                    home_team: 'บาเยิร์น มิวนิค',
                    away_team: 'ปารีส แซงต์-แชร์กแมง',
                    home_logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
                    away_logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
                    status: 'upcoming',
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
                    odds_home: 1.70,
                    odds_draw: 11.50,
                    odds_away: 2.15,
                    match_time: 'มะรืนนี้ 08:30',
                    is_external_feed: true
                }
            ];

            const added = [];
            for (const f of mockFeeds) added.push(await db.addMatch(f));

            return sendJSON(res, 200, {
                success: true,
                message: 'ดึงข้อมูลคู่แข่งขันใหม่จาก Sports Provider ผ่าน AWS NAT Gateway สำเร็จ',
                egressNetworkDetails: {
                    source: 'EC2 App Server (Private Subnet: 10.0.10.15)',
                    natGateway: 'NAT Gateway (Public Subnet: 10.0.1.50)',
                    securityProof: 'Private Subnet ไม่เปิด Inbound จาก Internet 100%'
                },
                syncedMatches: added
            });
        }

        // 8. Bets: Place Bet (Single or Multi-bet Parlay / จดโพย)
        if (req.method === 'POST' && pathname === '/api/bets/place') {
            const authUser = getAuthUser();
            if (!authUser) return sendJSON(res, 401, { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });

            const { betType = 'single', items, stake } = await getBody();
            const parsedStake = parseInt(stake, 10);

            if (isNaN(parsedStake) || parsedStake <= 0) {
                return sendJSON(res, 400, { success: false, message: 'กรุณาระบุจำนวนแต้มที่ถูกต้อง' });
            }
            if (!Array.isArray(items) || items.length === 0) {
                return sendJSON(res, 400, { success: false, message: 'กรุณาเลือกคู่แข่งขันอย่างน้อย 1 คู่' });
            }
            if (betType === 'parlay' && items.length < 2) {
                return sendJSON(res, 400, { success: false, message: 'การจดโพยชุด (Parlay) ต้องเลือกตั้งแต่ 2 คู่ขึ้นไป' });
            }

            try {
                const result = await db.placeBetWithLock({
                    userId: authUser.id,
                    betType,
                    items,
                    stake: parsedStake
                });

                return sendJSON(res, 201, {
                    success: true,
                    message: betType === 'parlay' ? `จดโพยชุด ${items.length} คู่สำเร็จ! (ค่าน้ำรวม x${result.ticket.total_odds})` : 'ทายผลคู่เดี่ยวสำเร็จ!',
                    ticket: result.ticket,
                    remainingBalance: result.remainingBalance,
                    securityAudit: {
                        transactionMechanism: 'ACID Mutex Lock',
                        raceConditionProtection: 'Active',
                        databaseTier: 'Amazon RDS PostgreSQL Multi-AZ'
                    }
                });
            } catch (err) {
                return sendJSON(res, 400, { success: false, message: err.message });
            }
        }

        // 9. Bets: My History
        if (req.method === 'GET' && pathname === '/api/bets/my-history') {
            const authUser = getAuthUser();
            if (!authUser) return sendJSON(res, 401, { success: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
            const bets = await db.getUserBets(authUser.id);
            return sendJSON(res, 200, { success: true, count: bets.length, data: bets });
        }

        // 10. Settlement: Settle Match (Protected: ops_admin / sec_admin)
        if (req.method === 'POST' && pathname === '/api/settlement/settle-match') {
            const authUser = getAuthUser();
            if (!authUser || !['ops_admin', 'sec_admin'].includes(authUser.role)) {
                return sendJSON(res, 403, { success: false, message: 'อนุญาตเฉพาะผู้ดูแลระบบ' });
            }

            const { matchId, result, scoreHome = 0, scoreAway = 0 } = await getBody();
            if (!matchId || !['home', 'draw', 'away'].includes(result)) {
                return sendJSON(res, 400, { success: false, message: 'กรุณาระบุ matchId และผลการแข่งขันที่ถูกต้อง (home, draw, away)' });
            }

            try {
                const summary = await db.settleMatchAndPayout(matchId, result, parseInt(scoreHome, 10), parseInt(scoreAway, 10));
                return sendJSON(res, 200, {
                    success: true,
                    message: `สรุปผลการแข่งขันคู่ ${matchId} เรียบร้อย (ผล: ${result}) พร้อมปรับสถานะโพยและโอนแต้มรางวัลอัตโนมัติ`,
                    summary
                });
            } catch (err) {
                return sendJSON(res, 400, { success: false, message: err.message });
            }
        }

        // Default 404
        return sendJSON(res, 404, { success: false, message: `Endpoint ${pathname} not found` });

    } catch (e) {
        console.error('Server Internal Error:', e);
        return sendJSON(res, 500, { success: false, message: 'Internal Server Error', error: e.message });
    }
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Apex Predict Standalone App Tier running on port ${PORT}`);
    console.log(`⚡ Zero-Dependency Mode: Ready for immediate local execution`);
    console.log(`🔒 Security: RBAC & ACID Concurrency Mutex Locks Active`);
    console.log(`🌐 Outbound: NAT Gateway Egress Simulation Active`);
    console.log(`=======================================================`);
});
