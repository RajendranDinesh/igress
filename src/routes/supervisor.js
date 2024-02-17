import express from 'express';

import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();

// supervisor dashboard data - title, test_id, scheduled date, total number of student
router.get('/dashboard-data',authenticate(['supervisor']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(
            `SELECT 
                c.scheduled_at,
                t.test_id, t.title,
                COUNT(cs.student_id) AS total_students 
            FROM 
                classroom_tests c 
            JOIN 
                tests t ON c.test_id = t.test_id 
            LEFT JOIN 
                classroom_student cs ON c.classroom_id = cs.classroom_id 
            join 
                test_supervisors ts on cs.classroom_id = ts.classroom_id
            WHERE 
                ts.supervisor_id = 3
                GROUP BY c.scheduled_at, t.test_id, t.title;`,
            [`${req.userData.userId}`]
        );
        res.status(200).send({ tests: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// student details page -->

// sent the title and total number of sutents in the test
router.get('/header/:id',authenticate(['supervisor']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(
            `SELECT 
                t.title,
                COUNT(cs.student_id) AS total_students 
            FROM 
                classroom_tests c 
            JOIN 
                tests t ON c.test_id = t.test_id 
            LEFT JOIN 
                classroom_student cs ON c.classroom_id = cs.classroom_id 
            join 
                test_supervisors ts on cs.classroom_id = ts.classroom_id
            WHERE 
                ts.supervisor_id = ?
                AND c.test_id = ?
                GROUP BY t.title;`,
            [`${req.userData.userId}`,req.params.id]
        );
        res.status(200).send({ test: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.post('/block-student/:id',authenticate(['supervisor']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(
            `UPDATE
                users
            SET
                is_active = 0,
                block_reason = ?,
                blocked_by = ?
            WHERE
                user_id = ?;`,
            [req.body.student_id,req.body.block_reason,req.userData.userId]
        );
        res.status(200).send({ message: "Student Blocked Successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

// students active and blocked details with tab_switch count
router.get('/active-blocked-students/:id',authenticate(['supervisor']), async (req, res) => {
    try {

        const supervisorSql = `
        SELECT 
            u.user_id, 
            u.roll_no, 
            u.email, 
            u.user_name,
            u.is_active,
            a.tab_switch
        FROM 
            classroom_tests ct 
        JOIN 
            classroom_student cs ON ct.classroom_id = cs.classroom_id 
        JOIN 
            users u ON cs.student_id = u.user_id 
        join 
            test_supervisors ts on cs.classroom_id = ts.classroom_id
		LEFT JOIN
            attendence_tab a ON u.user_id = a.student_id AND ct.test_id = a.test_id
        WHERE 
            ct.test_id = ?
            AND ts.supervisor_id = ?`;

        const [users] = await promisePool.execute(supervisorSql, [req.params.id,req.userData.userId]);

        res.status(200).send({ students: users });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.get('/blocked-details/:id',authenticate(['supervisor']), async (req, res) => {
    try {

        const [rows, fields] = await promisePool.query( `
        SELECT 
            u.roll_no, 
            u.email, 
            u.user_name, 
            u.block_reason,
            ub.user_name AS blocked_by_user_name
        FROM 
            users u
        LEFT JOIN 
            users ub ON u.blocked_by = ub.user_id
        WHERE 
            u.user_id = ?;`
        ,[req.body.student_id]);

        res.status(200).send({ blocked_setails: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.get('/attendence/:id',authenticate(['supervisor']), async (req, res) => {
    try {

        const supervisorSql = `
        SELECT 
            u.user_id,
            u.user_name AS username,
            u.roll_no AS roll_number,
            CASE WHEN a.student_id IS NOT NULL THEN 1 ELSE 0 END AS is_present
        FROM
            users u
        INNER JOIN
            classroom_student cs ON u.user_id = cs.student_id
        INNER JOIN
            classroom_tests ct ON cs.classroom_id = ct.classroom_id
        LEFT JOIN
            attendence_tab a ON u.user_id = a.student_id AND ct.test_id = a.test_id
        inner join
            test_supervisors ts on cs.classroom_id = ts.classroom_id
        WHERE
            ts.test_id = ?
            AND u.is_active = 1;`

        const [users] = await promisePool.execute(supervisorSql, [req.params.id]);

        res.status(200).send({ attendence : users });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.post('/attendence-present/:id',authenticate(['supervisor']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(
            `INSERT INTO 
                attendence_tab (student_id, test_id, tab_switch) 
            VALUES 
                (?, ?, 0);`,
            [req.body.student_id,req.params.id]
        );
        res.status(200).send({ message: "Attendence Marked Successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.post('/attendence-absent/:id',authenticate(['supervisor']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(
            `DELETE FROM 
                attendence_tab 
            WHERE 
                student_id = ? 
                AND test_id = ?;`,
            [req.body.student_id,req.params.id]
        );
        res.status(200).send({ message: "Attendence Marked Successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

export default router;