import express from 'express';

import { Logger } from '../utils/logger.js';
import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();
const logger = new Logger();

// POST /classrooms/create - Create a new classroom
router.post('/create', authenticate(['staff', 'admin']), async (req, res) => {
    try {
        const { name, description = null } = req.body;
        if (!name) {
            return res.status(400).send({ error: 'Name is required' });
        }

        const insertSql = `INSERT INTO classrooms (name, description, created_by) VALUES (?, ?, ?)`;
        const [result] = await promisePool.execute(insertSql, [name, description, req.userData.userId]);

        res.status(201).send({ message: 'Classroom created', classroomId: result.insertId });
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /classroom/all - Get all classrooms
router.get('/all', authenticate(['staff','admin']), async (req, res) => {
    try {
        const selectSql = `
            SELECT c.classroom_id, c.name, c.description, c.created_at, c.updated_at, u.roll_no AS created_by
            FROM classrooms c
            INNER JOIN users u ON c.created_by = u.user_id`;
        const [classrooms] = await promisePool.query(selectSql);
        res.send(classrooms);
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /classroom/:id - Get a specific classroom by Id
router.get('/id/:id', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { id } = req.params;

        const selectSql = `
            SELECT c.classroom_id, c.name, c.description, c.created_at, c.updated_at, u.roll_no AS created_by
            FROM classrooms c
            INNER JOIN users u ON c.created_by = u.user_id
            WHERE c.classroom_id = ?`;

        const [classrooms] = await promisePool.execute(selectSql, [id]);

        if (classrooms.length === 0) {
            return res.status(404).send({ error: 'Classroom not found' });
        }

        res.send(classrooms[0]);
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /classroom/user/:userId - Get classrooms associated to a user
router.get('/user/:userId', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        let { userId } = req.params;

        if (userId === "me") {
            userId = req.userData.userId;
        }

        const selectSql = `
            SELECT c.classroom_id, c.name, c.description, c.created_at, c.updated_at 
            FROM classrooms c
            LEFT JOIN classroom_staff cs ON c.classroom_id = cs.classroom_id
            WHERE c.created_by = ? OR cs.staff_id = ?
            GROUP BY c.classroom_id
        `;

        const [classrooms] = await promisePool.execute(selectSql, [userId, userId]);

        res.send(classrooms);
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// PUT /classroom/:id - Update a classroom
router.put('/:id', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        let updateFields = [];
        let queryParams = [];

        if (name) {
            updateFields.push('name = ?');
            queryParams.push(name);
        }

        if (description !== undefined) {
            updateFields.push('description = ?');
            queryParams.push(description);
        }

        if (updateFields.length === 0) {
            return res.status(400).send({ error: 'No update fields provided' });
        }

        const updateSql = `UPDATE classrooms SET ${updateFields.join(', ')} WHERE classroom_id = ?`;
        queryParams.push(id);

        const [result] = await promisePool.execute(updateSql, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Classroom not found' });
        }

        res.send({ message: 'Classroom updated' });
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// DELETE /classroom/:id - Delete a classroom
router.delete('/:id', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { id } = req.params;
        const deleteSql = `DELETE FROM classrooms WHERE classroom_id = ?`;
        const [result] = await promisePool.execute(deleteSql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Classroom not found' });
        }

        res.send({ message: 'Classroom deleted' });
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /classroom/:classroomId/staff - Get all staffs from a classroom
router.get('/:classroomId/staff', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId } = req.params;

        const selectSql = `
            SELECT u.user_id, u.roll_no, u.email, u.role 
            FROM users u 
            INNER JOIN classroom_staff cs ON u.user_id = cs.staff_id 
            WHERE cs.classroom_id = ? AND u.role = 'staff'`;

        const [staffMembers] = await promisePool.query(selectSql, [classroomId]);

        res.status(200).send(staffMembers);
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// POST /classroom/:classroomId/staff - Add a staff to a classroom
router.post('/:classroomId/staff', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId } = req.params;
        const { staffEmail } = req.body;

        if (!staffEmail) {
            return res.status(400).send({ error: 'Staff email is required' });
        }

        const userSql = `SELECT user_id FROM users WHERE email = ? AND role = 'staff'`;
        const [users] = await promisePool.execute(userSql, [staffEmail]);

        if (users.length === 0) {
            return res.status(404).send({ error: 'No staff member found with the provided email' });
        }

        const staffId = users[0].user_id;

        const insertSql = `INSERT INTO classroom_staff (classroom_id, staff_id) VALUES (?, ?)`;
        await promisePool.execute(insertSql, [classroomId, staffId]);

        res.status(201).send({ message: 'Staff added to classroom' });
    } catch (error) {
        if (error.code == "ER_DUP_ENTRY") {
            res.status(403).send({ error: "Staff is already a part of the classroom" });
        } else {
            logger.error(`[CLASSROOM] ${error}`);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }
});

// DELETE /classrooms/:classroomId/staff/:staffId - Remove a staff from a classroom
router.delete('/:classroomId/staff/:staffId', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId, staffId } = req.params;

        const deleteSql = `DELETE FROM classroom_staff WHERE classroom_id = ? AND staff_id = ?`;
        const [result] = await promisePool.execute(deleteSql, [classroomId, staffId]);

        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Staff not found in classroom' });
        }

        res.send({ message: 'Staff removed from classroom' });
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// GET /classroom/:classroomId/student - Get all students from a classroom
router.get('/:classroomId/student', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId } = req.params;

        const selectSql = `
            SELECT u.user_id, u.roll_no, u.email, u.role 
            FROM users u 
            INNER JOIN classroom_student cs ON u.user_id = cs.student_id 
            WHERE cs.classroom_id = ? AND u.role = 'student'`;

        const [students] = await promisePool.query(selectSql, [classroomId]);

        res.status(200).send(students);
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// POST /classrooms/:classroomId/students - Add students to a classroom
router.post('/:classroomId/students', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId } = req.params;
        const { studentEmails } = req.body;

        if (!studentEmails || !Array.isArray(studentEmails) || studentEmails.length === 0) {
            return res.status(400).send({ error: 'Student\'s email(s) is/are required' });
        }

        let addedStudents = 0;
        for (let email of studentEmails) {
            const userSql = `SELECT user_id FROM users WHERE email = ? AND role = 'student'`;
            const [users] = await promisePool.execute(userSql, [email]);

            if (users.length > 0) {
                const studentId = users[0].user_id;
                const insertSql = `INSERT INTO classroom_student (classroom_id, student_id) VALUES (?, ?)`;
                try {
                    await promisePool.execute(insertSql, [classroomId, studentId]);
                    addedStudents++;
                } catch (error) {
                    if (error.code !== "ER_DUP_ENTRY") {
                        logger.error(`[CLASSROOM] Error adding student with email ${email}: ${error}`);
                    }
                }
            }
        }

        if (addedStudents === 0) {
            return res.status(404).send({ error: 'No valid students found or all students are already added' });
        }

        res.status(201).send({ message: `${addedStudents} students added to classroom` });
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// DELETE /classrooms/:classroomId/students/:studentId - Remove a student from a classroom
router.delete('/:classroomId/student/:studentId', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId, studentId } = req.params;

        const deleteSql = `DELETE FROM classroom_students WHERE classroom_id = ? AND student_id = ?`;
        const [result] = await promisePool.execute(deleteSql, [classroomId, studentId]);

        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Student not found in classroom' });
        }

        res.send({ message: 'Student removed from classroom' });
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


export default router;