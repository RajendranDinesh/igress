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
});

router.get('/blocked', authenticate(['admin']), async(_, res) => {
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
                r.role_name = 'staff' AND u.is_active = 0 AND ub.is_active = 1;
            `,
        );
        res.status(200).send({ staffs: rows });
    } catch (error) {
        logger.error(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
});

router.put(`/unblock/:blockId`, authenticate(['admin']), async(req, res) => {
    const { blockId } = req.params;
    const userId = req.userData.userId;

    let connection = await promisePool.getConnection()
    
    try {
        await connection.beginTransaction();

        let blockTableQuery = `UPDATE user_blocks ub SET ub.unblocked_by = ?, ub.is_active = 0, ub.unblocked_at = now() WHERE ub.block_id = ?;`
        await connection.query(blockTableQuery, [userId, blockId]);

        let selectuserIdQuery = `SELECT ub.user_id FROM user_blocks ub WHERE ub.block_id = ?;`
        const [result] = await connection.query(selectuserIdQuery, [blockId]);

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

router.post(`/block/:facultyId`, authenticate(['admin']), async(req, res) => {
    const { facultyId } = req.params;
    const userId = req.userData.userId;

    const { reason } = req.body;

    let connection = await promisePool.getConnection();
    
    try {
        await connection.beginTransaction();

        let selectuserIdQuery = `SELECT u.user_id FROM users u WHERE u.roll_no = ?;`
        const [result] = await connection.query(selectuserIdQuery, [facultyId]);

        const blockedUserId = result[0].user_id;

        let blockTableQuery = `INSERT INTO user_blocks(user_id, block_reason, blocked_by) VALUES(?, ?, ?);`
        await connection.query(blockTableQuery, [blockedUserId, reason, userId]);

        let userTableQuery = `UPDATE users u SET is_active = 0 WHERE u.user_id = ?;`
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

export default router;