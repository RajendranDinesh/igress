import express from 'express';

import authenticate from '../utils/auth.js';
import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';

const logger = new Logger();
const router = express.Router();

router.get('/dashboard', authenticate(['admin']), async (_, res) => {
    try {
        const [rows,] = await promisePool.query(`
            SELECT 
                r.role_name AS role, COUNT(DISTINCT u.user_id) AS staff_count
            FROM users u
            JOIN user_roles ur ON u.user_id = ur.user_id
            JOIN roles r ON r.role_id = ur.role_id
            GROUP BY r.role_id;
            `,
        );
        res.status(200).send({ dashboard: rows });
    } catch (error) {
        logger.error(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
});

router.get('/blocked/student', authenticate(['admin']), async(_, res) => {
    try {
        const [rows,] = await promisePool.query(`
            SELECT
                ub.block_id, u.user_name, u.roll_no, ub.block_reason AS reason FROM users u
            JOIN
                user_roles ur ON u.user_id = ur.user_id
            JOIN
                roles r ON r.role_id = ur.role_id 
            JOIN
                user_blocks ub ON ub.user_id = u.user_id 
            WHERE
                r.role_name = 'student' AND u.is_active = 0 AND ub.is_active = 1;
            `,
        );
        res.status(200).send({ students: rows });
    } catch (error) {
        logger.error(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
});

router.put(`/unblock/student/:blockId`, authenticate(['admin']), async(req, res) => {
    const { blockId } = req.params;
    const userId = req.userData.userId;

    let connection = await promisePool.getConnection()
    
    try {
        await connection.beginTransaction();

        let blockTableQuery = `UPDATE user_blocks ub SET ub.unblocked_by = ?, ub.is_active = 0, ub.unblocked_at = now() WHERE ub.block_id = ?;`
        await connection.query(blockTableQuery, [userId, blockId]);

        let selectuserIdQuery = `SELECT ub.user_id FROM user_blocks ub WHERE ub.block_id = ?;`
        const [result] = await connection.query(selectuserIdQuery, [blockId]);

        if (result.length === 0) {
            return res.status(404).send({ error: "Student with given Roll Number doesn't exists." });
        }

        const blockedUserId = result[0].user_id;

        let userTableQuery = `UPDATE users u SET is_active = 1 WHERE u.user_id = ?;`
        await connection.query(userTableQuery, [blockedUserId]);

        await connection.commit();

        res.sendStatus(200);        
    } catch (error) {
        await connection.rollback();

        logger.error(error);
        res.status(500).send({ error: "Internal Server Error"});
    } finally {
        connection.release();
    }
});

router.post('/block/student/:rollNumber', authenticate(['admin']), async (req, res) => {
    const rollNumber = req.params.rollNumber;

    let connection = await promisePool.getConnection();

    try {
        await connection.beginTransaction();

        let selectuserIdQuery = `SELECT u.user_id FROM users u WHERE u.roll_no = ?;`
        const [result] = await connection.query(selectuserIdQuery, [rollNumber]);
        
        if (result.length === 0) {
            return res.status(404).send({ error: "Student with given Roll Number doesn't exists." });
        }

        const blockedUserId = result[0].user_id;

        await connection.query(
            `UPDATE users u
            SET is_active = 0
            WHERE u.user_id = ?;`,
            [blockedUserId]
        );

        await connection.query(
            `INSERT INTO user_blocks (user_id, block_reason, blocked_by)
            VALUES (?, ?, ?);`,
            [blockedUserId, req.body.reason, req.userData.userId]
        );

        await connection.commit();

        res.status(200).send({ message: "Student Blocked Successfully" });
    } catch (error) {
        await connection.rollback();

        logger.error(error);
        
        res.status(500).send({ error: "Internal Server Error"});
    } finally {
        connection.release();
    }
}
);

export default router;