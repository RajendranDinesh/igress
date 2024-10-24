import express from 'express';

import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();

// supervisor dashboard data - title, test_id, scheduled date, total number of student
router.get('/dashboard-data',authenticate(['supervisor']), async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query(
            `SELECT 
                c.id, 
                t.title, 
                t.test_id, 
                c.scheduled_at,
                COUNT(cs.student_id) AS total_students 
            FROM 
                classroom_tests c 
            JOIN 
                tests t ON t.test_id = c.test_id 
            JOIN 
                classroom_student cs ON cs.classroom_id = c.classroom_id 
            JOIN
                test_supervisors ts ON ts.classroom_test_id = c.id
            where
                ts.supervisor_id = ?
            GROUP BY 
                c.id, 
                t.test_id, 
                t.title,
                c.scheduled_at;`,
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
                c.id,
                t.title, 
                COUNT(cs.student_id) AS total_students 
            FROM 
                classroom_tests c 
            JOIN 
                tests t ON t.test_id = c.test_id 
            JOIN 
                classroom_student cs ON cs.classroom_id = c.classroom_id 
            JOIN
                test_supervisors ts ON ts.classroom_test_id = c.id
            where
                ts.supervisor_id = ? and
                c.id = ?
            GROUP BY 
                c.id,
                t.title;`,
            [`${req.userData.userId}`,req.params.id]
        );
        res.status(200).send({ test: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.post('/block-student', authenticate(['supervisor']), async (req, res) => {
    try {
        await promisePool.query(
            `UPDATE users
            SET is_active = 0
            WHERE user_id = ?;`,
            [req.body.student_id]
        );

        await promisePool.query(
            `INSERT INTO user_blocks (is_active, user_id, block_reason, blocked_by)
            VALUES (1, ?, ?, ?);`,
            [req.body.student_id, req.body.block_reason, req.userData.userId]
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
                c.id, 
                u.user_id, 
				u.roll_no, 
				u.email, 
				u.user_name,
				u.is_active,
                COALESCE(a.tab_switch, 0) AS tab_switch
            FROM 
                classroom_tests c 
            JOIN 
                classroom_student cs ON cs.classroom_id = c.classroom_id 
			JOIN
				users u on cs.student_id = u.user_id
            JOIN
                test_supervisors ts ON ts.classroom_test_id = c.id
			LEFT JOIN
				attendence_tab a ON u.user_id = a.student_id AND c.test_id = a.classroom_test_id
            where
                c.id = ? and ts.supervisor_id = ?;`;

        const [users] = await promisePool.execute(supervisorSql, [req.params.id,req.userData.userId]);

        res.status(200).send({ students: users });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.get('/blocked-details/:id/:student_id',authenticate(['supervisor']), async (req, res) => {
    try {

        const [rows, fields] = await promisePool.query( `
        SELECT
            u.roll_no,
            u.email,
            u.user_name,
            ub.block_reason,
            blocked_by_user.user_name AS blocked_by_user_name
        FROM
            user_blocks ub
        LEFT JOIN
            users u ON ub.user_id = u.user_id
        LEFT JOIN
            users blocked_by_user ON ub.blocked_by = blocked_by_user.user_id
        WHERE
            ub.user_id = ?;`
        ,[req.params.student_id]);

        res.status(200).send({ blocked_details: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

router.get('/attendence/:id',authenticate(['supervisor']), async (req, res) => {
    try {

        const supervisorSql = `
        select
            u.user_id,
            u.user_name AS username,
            u.roll_no AS roll_number,
            CASE 
                WHEN a.student_id IS NOT NULL THEN 1 
                ELSE 0 
            END AS is_present
        from
            classroom_tests ct
        join
            classroom_student cs on cs.classroom_id = ct.classroom_id
        join
            users u on cs.student_id = u.user_id
        join
            attendence_tab a on ct.id = a.classroom_test_id
        where
            ct.id = ? and u.is_active = 1;`

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
        // const [rows, fields] = await promisePool.query(`
        //     UPDATE attendence_tab
        //     SET is_present = 1
        //     WHERE student_id = ? 
        //     AND test_id = ?;
        //     `,
        //     [req.body.student_id,req.params.id]
        // );
        const [rows, fields] = await promisePool.query(`
            INSERT INTO attendence_tab (student_id, classroom_test_id, tab_switch)
            VALUES (?, ?, 0)
            ON DUPLICATE KEY UPDATE is_present = 1;
            `,
            [req.body.student_id, req.params.id]
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
        const [rows, fields] = await promisePool.query(`
            DELETE FROM attendence_tab
            WHERE student_id = ? 
            AND classroom_test_id = ?;
            `,
            [req.body.student_id, req.params.id]
        );
        res.status(200).send({ message: "Attendence Marked Successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

export default router;