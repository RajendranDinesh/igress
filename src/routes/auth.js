import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';

import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';

const logger = new Logger();

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { roll_no, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 8);

        const [result] = await promisePool.query(
            'INSERT INTO users (roll_no, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [roll_no, email, hashedPassword, role]
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

        const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).send({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.user_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.send({ message: 'Logged in successfully', token, userRole: user.role });
    } catch (error) {
        logger.error(`[Auth] ${error}`)
        res.status(500).send({ message: 'Error logging in', error });
    }
});

export default router;
