import express from 'express';
import promisePool from '../config/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query('SELECT * FROM questions');
        res.status(200).send({questions: rows});
    } catch (error) {
        console.log(error);
        res.status(500).send();
    }
});

router.get('/:id', async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
        res.status(200).send({question: rows[0]});
    } catch (error) {
        console.log(error);
        res.status(500).send();
    }
});

router.post('/', async (req, res) => {
    try {
        const [rows, fields] = await promisePool.query('INSERT INTO questions (title, level, description) VALUES (?, ?, ?)', [req.body.title, req.body.level, req.body.description]);
        const question_id = rows.insertId;

        const examples = req.body.examples;
        examples.forEach(async (example) => {
            await promisePool.query('INSERT INTO examples (question_id, example_text) VALUES (?, ?)', [question_id, example.text]);
        });

        const solutions = req.body.solutions;
        solutions.forEach(async (solution) => {
            await promisePool.query('INSERT INTO solutions (question_id, language_id, solution_text) VALUES (?, ?, ?)', [question_id, solution.language_id, solution.text]);
        });

        const test_cases = req.body.test_cases;
        test_cases.forEach(async (test_case) => {
            await promisePool.query('INSERT INTO test_cases (question_id, input, expected_output) VALUES (?, ?, ?)', [question_id, test_case.input, test_case.output]);
        });

        res.status(200).send({question: rows[0]});
    } catch (error) {
        console.log(error);
        res.status(500).send();
    }
});

export default router;