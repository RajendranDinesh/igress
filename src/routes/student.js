import express from 'express';

import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();

// student dashboard data - authenticated student after that return the classroom title and description of that students
router.get('/classrooms',authenticate(['student']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(`
            SELECT 
                c.classroom_id, c.name, c.description
            FROM 
                classroom_student cs 
            JOIN 
                classrooms c ON cs.classroom_id = c.classroom_id 
            WHERE 
                cs.student_id = ?;
            `,
            [`${req.userData.userId}`]
        );
        res.status(200).send({ classrooms: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// student/classroomTitle/${classroomId} - to send the classroom data to the student
router.get('/classroomTitle/:id', authenticate(['student']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(`
        select 
            c.name 
        from 
            classrooms c 
        where 
            c.classroom_id = ?;
        `,
        [`${req.params.id}`]
        );
        res.status(200).send({ classroom: rows[0] });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// /student/staffDetails/${id} - to send the staff details to the student
router.get('/staffDetails/:id', authenticate(['student']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(`
        select 
            u.user_name
        from 
            classroom_staff cs 
        join
            users u 
        on 
            cs.staff_id = u.user_id
        where 
            cs.classroom_id = ?;
        `,
        [`${req.params.id}`]
        );
        res.status(200).send({ staff: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// /student/classroomTests/${id} - to send the tests details to the student
router.get('/classroomTests/:id', authenticate(['student']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(`
        SELECT 
            t.test_id,
            t.title,
            t.description,
            u.user_name AS created_by,
            ct.scheduled_at,
            CASE
                WHEN ct.scheduled_at > NOW() THEN 'Upcoming'
                WHEN DATE_ADD(ct.scheduled_at, INTERVAL t.duration_in_minutes MINUTE) < DATE_ADD(NOW(), INTERVAL 330 MINUTE) THEN
                    CASE
                        WHEN a.is_present = 0 THEN 'Absent'
                        ELSE 'Attempted'
                    END
                ELSE 'Ongoing'
            END AS status
        FROM 
            classroom_tests ct
        INNER JOIN 
            tests t ON ct.test_id = t.test_id
        INNER JOIN 
            users u ON t.created_by = u.user_id
        LEFT JOIN 
            attendence_tab a ON ct.test_id = a.test_id AND a.student_id = ?
        WHERE 
            ct.classroom_id = ?;
        `,
        [`${req.userData.userId}`,`${req.params.id}`]
        );
        res.status(200).send({ tests: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// ongoing test for that student
router.get('/ongoingTest', authenticate(['student']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(`
        SELECT * FROM freedb_igress.users;SELECT 
            c.name AS class_name,
            t.title AS test_title,
            ct.scheduled_at,
            t.duration_in_minutes,
            t.test_id,
            ct.id AS classroom_test_id
        FROM 
            classroom_student cs
        JOIN 
            classrooms c ON cs.classroom_id = c.classroom_id
        JOIN 
            classroom_tests ct ON ct.classroom_id = cs.classroom_id
        JOIN 
            tests t ON t.test_id = ct.test_id
        LEFT JOIN 
            submitted_status s ON s.classroom_test_id = ct.id 
                            AND s.user_id = cs.student_id
        WHERE 
            cs.student_id = ?
            AND DATE_ADD(NOW(), INTERVAL 330 MINUTE) 
                BETWEEN ct.scheduled_at 
                AND DATE_ADD(ct.scheduled_at, INTERVAL t.duration_in_minutes MINUTE)
            AND s.classroom_test_id IS NULL;
        `,
        [`${req.userData.userId}`]
        );
        res.status(200).send({ tests: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// upcoming test for that student
router.get('/upcomingTest', authenticate(['student']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(`
        SELECT 
            c.name as class_name,t.title as test_title, ct.scheduled_at, t.duration_in_minutes
        FROM 
            classroom_student cs 
        JOIN 
            classrooms c ON cs.classroom_id = c.classroom_id 
        JOIN 
            classroom_tests ct ON ct.classroom_id = cs.classroom_id
        JOIN 
            tests t ON t.test_id = ct.test_id
        WHERE 
            cs.student_id = ?
            AND ct.scheduled_at > DATE_ADD(NOW(), INTERVAL 330 MINUTE);
        `,
        [`${req.userData.userId}`]
        );
        res.status(200).send({ tests: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);


export default router;