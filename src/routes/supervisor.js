import express from 'express';

import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();

// GET /tests - authenticate the supervisor and search if the supervisor is presnt in the db inside classroom_tests table in column supervisors if he is present make a joint with the tests table with the primary key of test_id in test table and test_id in classroom_tests table and return the value shedulted_at, test_title and also joint another table named classroom_student with the classroom_id column in classroom_tests table and classroom_id in classroom_student table and return the total count of student present in the linked classroom_id's

router.get('/api/hello',authenticate(['supervisor']), async (req, res) => {
    console.log("hello");
    console.log(`${req.userData.userId}`);
    try {
        const [rows, fields] = await promisePool.query(
            'SELECT c.scheduled_at, t.title, COUNT(cs.student_id) AS total_students FROM classroom_tests c JOIN tests t ON c.test_id = t.test_id LEFT JOIN classroom_student cs ON c.classroom_id = cs.classroom_id WHERE c.created_by = ? GROUP BY c.scheduled_at, t.title;',
            [`${req.userData.userId}`]
        );
        console.log(rows);
        console.log(fields);
        res.status(200).send({ tests: rows });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal Server Error"});
    }
}
);

export default router;