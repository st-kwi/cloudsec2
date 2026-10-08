const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

// Persona AWS Tier Permission Mapping (For Presentation & Security Audit)
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

exports.register = async (req, res) => {
    try {
        const { username, password, role = 'user' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
        }

        if (username.length < 3 || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Username ต้องอย่างน้อย 3 ตัวอักษร และ Password อย่างน้อย 6 ตัวอักษร' });
        }

        const existing = await db.findUserByUsername(username);
        if (existing) {
            return res.status(409).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
        }

        // Validate allowed persona role
        const validRole = ['user', 'ops_admin', 'sec_admin'].includes(role) ? role : 'user';

        const user = await db.createUser(username, password, validRole);
        const wallet = await db.getWalletByUserId(user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(201).json({
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
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
        }

        const user = await db.findUserByUsername(username);
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const wallet = await db.getWalletByUserId(user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
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
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await db.findUserById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });

        const wallet = await db.getWalletByUserId(user.id);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                balance: wallet ? wallet.balance : 0,
                tierPermissions: PERSONA_TIER_PERMISSIONS[user.role]
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
