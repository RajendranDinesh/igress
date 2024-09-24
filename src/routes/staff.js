import express from 'express';
import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';

const logger = new Logger();
const router = express.Router();

router.get('/all', async (_, res) => {
    try {
        const [rows,] = await promisePool.query(`
            SELECT 
                u.email, u.user_name, u.roll_no
            FROM 
                users u
            JOIN
                user_roles ur ON u.user_id = ur.user_id
            JOIN
                roles r ON r.role_id = ur.role_id
            WHERE
                r.role_name = 'staff';
            `,
        );
        res.status(200).send({ staffs: rows });
    } catch (error) {
        logger.error(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
})

export default router;