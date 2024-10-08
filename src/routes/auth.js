import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';

import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';

const logger = new Logger();

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { roll_no, userName, email, password, role } = req.body;

        if (!roll_no || !userName || !email || !password || !role) {
            return res.status(400).send({ message: 'Missing fields' });
        }

        const hashedPassword = await bcrypt.hash(password, 8);

        const [result] = await promisePool.query(
            `INSERT INTO users (roll_no, user_name, email, password_hash) VALUES (?, ?, ?, ?)`,
            [roll_no, userName, email, hashedPassword]
        );

        const [roleId] = await promisePool.query('SELECT role_id FROM roles WHERE role_name = ?', [role]);

        const insertUserRoleSql = `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`;

        await promisePool.query(insertUserRoleSql, [result.insertId, roleId[0].role_id]);

        res.status(201).send({ message: 'User registered', userId: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).send({ message: 'Email (or) roll number already in use' });
        }

        logger.error(error)
        res.status(500).send({ message: 'Error registering user', error });
    }
});


router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await promisePool.query(`
            SELECT u.user_id, u.password_hash, r.role_name, u.is_active
            FROM users u
            JOIN user_roles ur ON u.user_id = ur.user_id
            JOIN roles r ON ur.role_id = r.role_id
            WHERE u.email = ?;
        `, [email])

        const userRoles = users.map(user => user.role_name);

        const user = users[0];

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).send({ message: 'Invalid credentials' });
        }

        const isActive = users.some((user) => user.is_active ? true : false);

        if (!isActive) {
            return res.status(498).send({ message: '[AUTH] Account Inactive' });
        }

        const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.send({ message: 'Logged in successfully', token, userRoles: userRoles });
    } catch (error) {
        logger.error(`[Auth] ${error}`)
        res.status(500).send({ message: 'Error logging in', error });
    }
});

router.delete('/remove/:emailId', async (req, res) => {
    try {
        const { emailId } = req.params;

        await promisePool.query('DELETE FROM users WHERE email = ?', [emailId]);

        res.send({ message: 'User deleted' });
    } catch (error) {
        logger.error(`[Auth] ${error}`)
        res.status(500).send({ message: 'Error deleting user', error });
    }
});

export default router;
