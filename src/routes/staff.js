import express from 'express';

import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const logger = new Logger();
const router = express.Router();

router.get('/all', authenticate(['admin']), async (_, res) => {
    try {
        const [rows,] = await promisePool.query(`
            SELECT 
                u.email, u.user_name, u.roll_no, u.created_at, u.is_active AS status, COUNT(DISTINCT cs.classroom_id) AS class_count, COUNT(DISTINCT ct.id) AS test_assigned, COUNT(DISTINCT t.test_id) AS test_created
            FROM users u
            JOIN user_roles ur ON u.user_id = ur.user_id
            JOIN roles r ON r.role_id = ur.role_id
            LEFT JOIN classroom_staff cs ON u.user_id = cs.staff_id 
            LEFT JOIN classroom_tests ct ON u.user_id = ct.created_by 
            LEFT JOIN tests t ON u.user_id = t.created_by 
            WHERE r.role_name = 'staff'
            GROUP BY u.email;
            `,
        );
        res.status(200).send({ staffs: rows });
    } catch (error) {
        logger.error(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
})

export default router;