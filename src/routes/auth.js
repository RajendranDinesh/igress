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
            'INSERT INTO users (roll_no, user_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [roll_no, userName, email, hashedPassword, role]
        );

        res.status(201).send({ message: 'User registered', userId: result.insertId });
    } catch (error) {
        logger.debug(error)
        res.status(500).send({ message: 'Error registering user', error });
    }
});


router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await promisePool.query(`
            SELECT u.user_id, u.password_hash, r.role_name
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
