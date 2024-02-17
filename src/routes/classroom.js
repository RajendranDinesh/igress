import express from 'express';
import bcrypt from 'bcryptjs';

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
router.get('/all', authenticate(['staff', 'admin']), async (req, res) => {
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

        const limit = parseInt(req.query.limit) || 10; // Default limit is 10
        const page = parseInt(req.query.page) || 1; // Default page is 1
        const offset = (page - 1) * limit; // Calculate offset

        if (userId === "me") {
            userId = req.userData.userId;
        }

        const selectSql = `
            SELECT c.classroom_id, c.name, c.description, c.created_at, c.updated_at 
            FROM classrooms c
            LEFT JOIN classroom_staff cs ON c.classroom_id = cs.classroom_id
            WHERE c.created_by = ? OR cs.staff_id = ?
            GROUP BY c.classroom_id
            LIMIT ? OFFSET ?
        `;

        const [classrooms] = await promisePool.query(selectSql, [userId, userId, limit, offset]);

        const countSql = `
            SELECT COUNT(DISTINCT c.classroom_id) AS total
            FROM classrooms c
            LEFT JOIN classroom_staff cs ON c.classroom_id = cs.classroom_id
            WHERE c.created_by = ? OR cs.staff_id = ?
        `;

        const [[{ total }]] = await promisePool.execute(countSql, [userId, userId]);

        res.send({
            classrooms, total,
            pages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.log(error)
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
router.get('/:classroomId/staffs', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId } = req.params;

        const selectSql = `
            SELECT u.user_id, u.roll_no, u.email, u.user_name
            FROM users u
            INNER JOIN classroom_staff cs ON u.user_id = cs.staff_id
            INNER JOIN user_roles ur ON u.user_id = ur.user_id
            INNER JOIN roles r ON ur.role_id = r.role_id
            WHERE cs.classroom_id = ? AND r.role_name = 'staff';
        `;

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
        const { email } = req.body;

        if (!email) {
            return res.status(400).send({ error: 'Staff email is required' });
        }

        const userSql = `
            SELECT u.user_id FROM users u
            JOIN user_roles ur ON u.user_id = ur.user_id
            JOIN roles r ON ur.role_id = r.role_id
            WHERE email = ? AND role_name = 'staff';
        `;

        const [users] = await promisePool.execute(userSql, [email]);

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
router.get('/:classroomId/students', authenticate(["staff", "admin"]), async (req, res) => {
    try {
        const { classroomId } = req.params;

        const selectSql = `
        SELECT u.user_id, u.roll_no, u.email, u.user_name
        FROM users u
        INNER JOIN classroom_student cs ON u.user_id = cs.student_id
        INNER JOIN user_roles ur ON u.user_id = ur.user_id
        INNER JOIN roles r ON ur.role_id = r.role_id
        WHERE cs.classroom_id = ? AND r.role_name = 'student';
        `;

        const [students] = await promisePool.query(selectSql, [classroomId]);

        res.status(200).send(students);
    } catch (error) {
        logger.error(`[CLASSROOM] ${error}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

// POST /classrooms/:classroomId/students - Add students to a classroom
router.post('/:classroomId/students', authenticate(["staff", "admin"]), async (req, res) => {

    async function addStudentToClassroomDB(classroomId, studentId, role_name) {
        const insertSql = `INSERT INTO classroom_student (classroom_id, student_id) VALUES (?, ?)`;
        const selectRoleSql = `SELECT role_id FROM roles WHERE role_name = ?`;

        try {
            await promisePool.execute(insertSql, [classroomId, studentId]);
            const [roleResult] = await promisePool.execute(selectRoleSql, [role_name]);

            if (roleResult.length === 0) {
                throw new Error(`Role ${roleName} not found.`);
            }
            const roleId = roleResult[0].role_id;

            const insertUserRoleSql = `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`;
            await promisePool.execute(insertUserRoleSql, [studentId, roleId]);

        } catch (error) {
            if (error.code !== "ER_DUP_ENTRY") {
                logger.error(`[CLASSROOM] Error adding student: ${error}`);
            }
            throw new Error(`[ADD Student To DB] ${error}`)
        }
    }

    async function getStudentUserId(email) {
        const checkSql = `
        SELECT u.user_id, u.email
        FROM users u
        WHERE u.email = ?;
        `

        const [users] = await promisePool.execute(checkSql, [email]);

        if (users.length === 0) {
            return false;
        }

        return users[0];
    }

    async function isStudentInClassroom(classroomId, studentId) {
        const checkSql = `SELECT * FROM classroom_student WHERE classroom_id = ? AND student_id = ?`;
        const [result] = await promisePool.execute(checkSql, [classroomId, studentId]);

        return result.length > 0;
    }

    async function createUser(roll_no, userName, email, passwordHash) {
        const insertUserSql = `INSERT INTO users (roll_no, user_name, email, password_hash) VALUES (?, ?, ?, ?)`;
        const [userResult] = await promisePool.execute(insertUserSql, [roll_no, userName, email, passwordHash]);
        const userId = userResult.insertId;

        return userId;
    }

    try {
        const { classroomId } = req.params;
        const { students } = req.body; // Changed from studentEmails to students

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).send({ error: 'Student details are required' });
        }

        let addedStudents = 0;
        let createdAccounts = 0;
        let failedToAdd = [];
        let existingUsersAdded = 0;

        for (let student of students) {
            const { email, roll_number, user_name } = student;

            if (!email) {
                failedToAdd.push({ roll_number, reason: 'Missing email' });
                continue;
            } else if (!roll_number) {
                failedToAdd.push({ email, reason: 'Missing roll number' });
                continue;
            } else if (!user_name) {
                failedToAdd.push({ email, roll_number, reason: 'Missing user name' });
                continue;
            }

            try {
                // Check if the user already exists
                const userExists = await getStudentUserId(email);

                if (userExists) {
                    // Check if already added to classroom
                    const alreadyAdded = await isStudentInClassroom(classroomId, userExists.user_id);

                    if (!alreadyAdded) {
                        // Add existing user to classroom
                        await addStudentToClassroomDB(classroomId, userExists.user_id, 'student');
                        existingUsersAdded++;
                    } else {
                        // User already in classroom, add to failedToAdd with reason
                        failedToAdd.push({ email, roll_number, reason: 'User already added to classroom' });
                    }
                } else {
                    // Create user and add to classroom
                    const passwordHash = await bcrypt.hash(email, 8);
                    const userId = await createUser(roll_number, user_name, email, passwordHash);
                    await addStudentToClassroomDB(classroomId, userId, 'student');
                    createdAccounts++;
                }

                addedStudents++;
            } catch (error) {
                // Log error and add to failedToAdd list
                logger.error(`[CLASSROOM] Error processing student with roll number ${roll_number} (${email}): ${error}`);
                failedToAdd.push({ email, roll_number, reason: 'Failed to add to database' });
            }
        }

        // Prepare detailed response
        let responseMessage = `${addedStudents} students processed. ${createdAccounts} new accounts created. ${existingUsersAdded} existing users added to classroom.`;
        if (failedToAdd.length > 0) {
            responseMessage += ` Some students could not be added.`;
        }

        res.status(201).send({
            message: responseMessage,
            details: {
                createdAccounts,
                existingUsersAdded,
                failedToAdd
            }
        });
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