import express from 'express';
import moment from 'moment-timezone';

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

            if (isNaN(duration_in_minutes)) {
                return res.status(400).send({ error: 'Duration must be a number' });
            }

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
router.delete('/:testId', authenticate(['admin', 'staff']), async (req, res) => {
    try {
        const { testId } = req.params;

        if (isNaN(testId)) {
            return res.status(400).send({ error: 'Invalid test ID' });
        }

        if (req.userRoles.includes('admin')) {
            let deleteSql = `DELETE FROM tests WHERE test_id = ?`;
            await promisePool.execute(deleteSql, [testId]);
        } else {
            let deleteSql = `DELETE FROM tests WHERE test_id = ? AND created_by = ?`;
            await promisePool.execute(deleteSql, [testId, req.userData.userId]);
        }

        res.status(200).send({ message: 'Test deleted' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/:testId - Get a specific test
router.get('/:testId', authenticate(["staff", "admin", "student", "supervisor"]), async (req, res) => {
    try {
        const { testId } = req.params;

        const selectSql = `SELECT test_id, title, description, duration_in_minutes FROM tests WHERE test_id = ?`;
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

// GET /test/:classroomId/tests - Get all scheduled tests of a classroom
router.get('/:classroomId/tests', authenticate(["admin", "staff", "student"]), async (req, res) => {
    try {
        const { classroomId } = req.params;
        const selectSql = `
            SELECT ct.id, t.test_id, t.title, t.description, t.duration_in_minutes, ct.scheduled_at FROM tests t
            JOIN classroom_tests ct ON t.test_id = ct.test_id
            WHERE ct.classroom_id = ?;
        `;

        const [tests] = await promisePool.execute(selectSql, [classroomId]);

        res.status(200).send(tests)
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/user/created-by-me - Get all tests created by the user
router.get('/user/created-by-me', authenticate(["admin", "staff"]), async (req, res) => {
    try {

        const selectSql = `SELECT test_id, title, description, duration_in_minutes FROM tests WHERE created_by = ?`;
        const [rows] = await promisePool.execute(selectSql, [req.userData.userId]);

        res.status(200).send({ tests: rows });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/:testId/classrooms - Get all classrooms where a test is scheduled
router.get('/:testId/classrooms', authenticate(["admin", "staff", "student"]), async (req, res) => {
    try {
        const { testId } = req.params;
        const selectSql = `
            SELECT c.classroom_id, c.name, c.description, c.created_at, ct.scheduled_at FROM classrooms c
            JOIN classroom_tests ct ON c.classroom_id = ct.classroom_id
            WHERE ct.test_id = ?;
        `;

        const [classrooms] = await promisePool.execute(selectSql, [testId]);

        res.status(200).send(classrooms)
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test - Get all tests
router.get('/', authenticate(["admin"]), async (req, res) => {
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
    let { classroom_id, test_id, scheduled_at, supervisor_id } = req.body;

    let connection = await promisePool.getConnection();

    try {
        await connection.beginTransaction();

        if (!classroom_id || !test_id || !scheduled_at || !supervisor_id) {
            return res.status(400).send({ error: 'Some reqired field is missing.' });
        }

        scheduled_at = moment(scheduled_at).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        const insertSql = `INSERT INTO classroom_tests (classroom_id, test_id, scheduled_at, created_by) VALUES (?, ?, ?, ?)`;
        const [result] = await connection.query(insertSql, [classroom_id, test_id, scheduled_at, req.userData.userId]);

        const supervisorInsert = `
            INSERT INTO freedb_igress.test_supervisors
            (classroom_test_id, supervisor_id)
            VALUES (?, ?), (?, ?);
        `;
        await connection.execute(supervisorInsert, [result.insertId, supervisor_id, result.insertId, req.userData.userId]);

        await connection.commit();

        res.status(201).send({ message: 'Test scheduled in classroom successfully' });
    } catch (error) {
        await connection.rollback();

        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    } finally {
        connection.release();
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

// DELETE /test/schedule/:classroom_id/:schedule_id - Cancel a scheduled test
router.delete('/schedule/:classroom_id/:schedule_id', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { classroom_id, schedule_id } = req.params;

        const deleteSql = `DELETE FROM classroom_tests WHERE classroom_id = ? AND id = ?`;
        await promisePool.execute(deleteSql, [classroom_id, schedule_id]);

        res.status(200).send({ message: 'Scheduled test cancelled' });
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/:id/staff - fetch all the staff member name with the test id
router.get('/:id/staff', authenticate(['staff']), async (req, res) => {
    try {
        const selectSql = `
            SELECT distinct(u.user_name) AS staff_name
            FROM classroom_tests ct
            JOIN classroom_staff cs ON ct.classroom_id = cs.classroom_id
            JOIN users u ON cs.staff_id = u.user_id
            WHERE ct.test_id = ?;
        `;

        const [staff] = await promisePool.execute(selectSql, [req.params.id]);
        res.status(200).send(staff);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /test/:id/supervisor - fetch all the supervisor name with the test id
router.get('/:id/supervisor', authenticate(['staff']), async (req, res) => {
    try {
        const selectSql = `
            SELECT u.user_name AS supervisor_name
            FROM users u
            JOIN test_supervisors ts ON u.user_id = ts.supervisor_id
            WHERE ts.classroom_test_id = ?;
        `;

        const [supervisors] = await promisePool.execute(selectSql, [req.params.id]);

        res.status(200).send(supervisors);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// "GET", `/test/${testId}/present-absent`
router.get('/:id/present-absent', authenticate(['staff']), async (req, res) => {
    try {
        const selectSql = `
            SELECT 
                SUM(CASE WHEN is_present = 1 THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN is_present = 0 THEN 1 ELSE 0 END) AS absent_count
            FROM 
                attendence_tab
            where
                test_id = ?;
        `;

        const [students] = await promisePool.execute(selectSql, [req.params.id]);

        res.status(200).send(students);
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

//"GET", `/test/${testId}/marks`
router.get('/:id/marks', authenticate(['staff']), async (req, res) => {
    try {
        const selectSql = `
        SELECT 
            u.user_name,
            SUM(tm.mark_awarded) AS total_marks
        FROM 
            test_marks tm
        INNER JOIN 
            users u ON tm.student_id = u.user_id
        where 
            test_id = ?
        GROUP BY 
            u.user_name;
        `;

        const [marks] = await promisePool.execute(selectSql, [req.params.id]);

        const selectSql1 = `
        SELECT 
            AVG(total_marks) AS overall_average_marks
        FROM 
            (SELECT 
                SUM(mark_awarded) AS total_marks
            FROM 
                test_marks
            where
                test_id = ?
            GROUP BY 
                student_id) AS subquery;
        `;

        const [averageMarks] = await promisePool.execute(selectSql1, [req.params.id]);

        res.status(200).send({marks, averageMarks});
    } catch (error) {
        logger.error(`[TEST] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

export default router;
