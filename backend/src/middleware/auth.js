/**
 * Authentication & Role-Based Access Control (RBAC) Middleware
 * Guards routes according to User Persona permissions across AWS 3-Tier
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_aws_term_project_secret_key_2026';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'ไม่พบ Access Token กรุณาเข้าสู่ระบบก่อนทำรายการ'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: 'Access Token ไม่ถูกต้องหรือหมดอายุการใช้งาน'
        });
    }
}

/**
 * Role-Based Access Control (RBAC) Guard
 * Allowed Roles:
 * - 'user': ผู้ใช้งานทั่วไป (หน้าบ้าน / ทายผล / ดูประวัติ)
 * - 'ops_admin': ผู้ดูแล App Tier (จัดการคู่แข่ง, ค่าน้ำ, สรุปผลการแข่ง)
 * - 'sec_admin': ผู้ดูแลความปลอดภัยระบบ (Audit Log, Config, สถาปัตยกรรมคลาวด์)
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'กรุณายืนยันตัวตนก่อน' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `การเข้าถึงถูกปฏิเสธ: บทบาท '${req.user.role}' ไม่มีสิทธิ์ใช้งานส่วนนี้ (อนุญาตเฉพาะ: ${allowedRoles.join(', ')})`,
                requiredTierPermission: allowedRoles
            });
        }

        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole,
    JWT_SECRET
};
