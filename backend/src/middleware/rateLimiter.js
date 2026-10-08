/**
 * API Rate Limiting Middleware (OWASP A07 & DDoS Protection)
 * Prevents automated brute-force attacks and betting race-conditions.
 */

// Resilient in-memory sliding window rate limiter
const requestCounts = new Map();

function createRateLimiter({ windowMs = 60000, max = 60, message = 'คำขอมากเกินไป กรุณารอสักครู่' }) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        const now = Date.now();

        if (!requestCounts.has(ip)) {
            requestCounts.set(ip, []);
        }

        const timestamps = requestCounts.get(ip).filter(time => now - time < windowMs);
        timestamps.push(now);
        requestCounts.set(ip, timestamps);

        if (timestamps.length > max) {
            return res.status(429).json({
                success: false,
                message: message,
                retryAfterSeconds: Math.ceil((windowMs - (now - timestamps[0])) / 1000)
            });
        }

        next();
    };
}

module.exports = {
    generalLimiter: createRateLimiter({ windowMs: 60 * 1000, max: 120, message: 'คำขอทั่วไปมากเกินกำหนด (Rate limit exceeded)' }),
    authLimiter: createRateLimiter({ windowMs: 60 * 1000, max: 15, message: 'พยายามเข้าสู่ระบบถี่เกินไป เพื่อความปลอดภัยกรุณารอ 1 นาที' }),
    bettingLimiter: createRateLimiter({ windowMs: 10 * 1000, max: 10, message: 'การส่งคำขอทายผลถี่เกินไป กรุณารอระบบประมวลผลสักครู่' })
};
