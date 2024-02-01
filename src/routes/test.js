import express from 'express';

import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();
const logger = new Logger();

// POST /test/create - Create a new test
router.post('/create', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { title, description = null, duration_in_minutes } = req.body;
        if (!title || !duration_in_minutes) {
            return res.status(400).send({ error: 'Title and duration are required' });
        }

        const insertSql = `INSERT INTO tests (title, description, created_by, duration_in_minutes) VALUES (?, ?, ?, ?)`;
        const [result] = await promisePool.execute(insertSql, [title, description, req.userData.userId, duration_in_minutes]);

        res.status(201).send({ message: 'Test created', testId: result.insertId });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// PUT /test/:testId - Update a test dynamically
router.put('/:testId', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { testId } = req.params;
        const { title, description, duration_in_minutes } = req.body;

        let updateFields = [];
        let queryParams = [];

        if (title) {
            updateFields.push('title = ?');
            queryParams.push(title);
        }

        if (description !== undefined) {
            updateFields.push('description = ?');
            queryParams.push(description);
        }

        if (duration_in_minutes) {
            updateFields.push('duration_in_minutes = ?');
            queryParams.push(duration_in_minutes);
        }

        if (updateFields.length === 0) {
            return res.status(400).send({ error: 'No update fields provided' });
        }

        const updateSql = `UPDATE tests SET ${updateFields.join(', ')} WHERE test_id = ?`;
        queryParams.push(testId);

        const [result] = await promisePool.execute(updateSql, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Test not found' });
        }

        res.status(200).send({ message: 'Test updated' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// DELETE /test/:testId - Delete a test
router.delete('/:testId', authenticate(['admin']), async (req, res) => {
    try {
        const { testId } = req.params;

        const deleteSql = `DELETE FROM tests WHERE test_id = ?`;
        await promisePool.execute(deleteSql, [testId]);

        res.status(200).send({ message: 'Test deleted' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/:testId - Get a specific test
router.get('/:testId', authenticate(), async (req, res) => {
    try {
        const { testId } = req.params;

        const selectSql = `SELECT * FROM tests WHERE test_id = ?`;
        const [rows] = await promisePool.execute(selectSql, [testId]);

        if (rows.length === 0) {
            return res.status(404).send({ error: 'Test not found' });
        }

        res.status(200).send(rows[0]);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test - Get all tests
router.get('/', authenticate(), async (req, res) => {
    try {
        const selectSql = `SELECT * FROM tests`;
        const [rows] = await promisePool.execute(selectSql);

        res.status(200).send(rows);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// POST /test/schedule - Schedule a test in a classroom
router.post('/schedule', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { classroom_id, test_id, scheduled_at } = req.body;
        if (!classroom_id || !test_id || !scheduled_at) {
            return res.status(400).send({ error: 'Classroom ID, Test ID, and Scheduled Time are required' });
        }

        const insertSql = `INSERT INTO classroom_tests (classroom_id, test_id, scheduled_at) VALUES (?, ?, ?)`;
        await promisePool.execute(insertSql, [classroom_id, test_id, scheduled_at]);

        res.status(201).send({ message: 'Test scheduled in classroom successfully' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// PUT /test/schedule/:classroom_id/:test_id - Update a scheduled test
router.put('/schedule/:classroom_id/:test_id', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { classroom_id, test_id } = req.params;
        const { scheduled_at } = req.body;

        const updateSql = `UPDATE classroom_tests SET scheduled_at = ? WHERE classroom_id = ? AND test_id = ?`;
        await promisePool.execute(updateSql, [scheduled_at, classroom_id, test_id]);

        res.status(200).send({ message: 'Scheduled test updated' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// DELETE /test/schedule/:classroom_id/:test_id - Cancel a scheduled test
router.delete('/schedule/:classroom_id/:test_id', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { classroom_id, test_id } = req.params;

        const deleteSql = `DELETE FROM classroom_tests WHERE classroom_id = ? AND test_id = ?`;
        await promisePool.execute(deleteSql, [classroom_id, test_id]);

        res.status(200).send({ message: 'Scheduled test cancelled' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/schedule/:classroom_id/:test_id - Get details of a scheduled test
router.get('/schedule/:classroom_id/:test_id', authenticate(), async (req, res) => {
    try {
        const { classroom_id, test_id } = req.params;

        const selectSql = `SELECT * FROM classroom_tests WHERE classroom_id = ? AND test_id = ?`;
        const [rows] = await promisePool.execute(selectSql, [classroom_id, test_id]);

        if (rows.length === 0) {
            return res.status(404).send({ error: 'Scheduled test not found' });
        }

        res.status(200).send(rows[0]);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/schedule/tests/:classroom_id - Get all scheduled tests for a classroom
router.get('/schedule/tests/:classroom_id', authenticate(), async (req, res) => {
    try {
        const { classroom_id } = req.params;

        const selectSql = `SELECT * FROM classroom_tests WHERE classroom_id = ?`;
        const [rows] = await promisePool.execute(selectSql, [classroom_id]);

        res.status(200).send(rows);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

export default router;
