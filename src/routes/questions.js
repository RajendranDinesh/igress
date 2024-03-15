import express from 'express';

import promisePool from '../config/db.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger();

// GET /question/:test_id - Get all questions of a test
router.get('/:test_id', async (req, res) => {
    const { test_id } = req.params;

    try {
        const query = `
            SELECT 
                q.question_id,
                COALESCE(q.question_title, q.question) AS question_title,
                qt.type_name, 
                q.created_at, 
                q.updated_at
            FROM questions q
            INNER JOIN question_type qt ON q.question_type = qt.type_id
            WHERE q.test_id = ?
            ORDER BY q.question_id ASC;
        `;

        const [questions] = await promisePool.query(query, [test_id]);

        if (questions.length > 0) {
            res.json(questions);
        } else {
            res.status(404).send('No questions found for the specified test.');
        }
    } catch (e) {
        logger.error(e);
        res.status(500).send('[QUESTION] Internal Server Error');
    }
});

// GET /question/:test_id/meta - Get metadata of all questions of a test
router.get('/:test_id/meta', async (req, res) => {
    const { test_id } = req.params;

    try {
        // data to return start time, end time, id and type of question
        const query = `
            SELECT
                q.question_id AS id,
                qt.type_name
            FROM questions q
            INNER JOIN question_type qt ON q.question_type = qt.type_id
            WHERE q.test_id = ?;
        `;

        const [questions] = await promisePool.query(query, [test_id]);

        const timeQuery = `
            SELECT
                ct.scheduled_at,
                DATE_ADD(ct.scheduled_at, INTERVAL t.duration_in_minutes MINUTE) AS end_time
            FROM tests t
            INNER JOIN classroom_tests ct ON t.test_id = ct.test_id
            WHERE t.test_id = ?;
        `;

        const [time] = await promisePool.query(timeQuery, [test_id]);

        if (questions.length > 0 && time.length > 0) {
            let meta = {
                questions: questions,
                startTime: time[0].scheduled_at,
                endTime: time[0].end_time
            }

            return res.send(meta);
        }

        res.status(404).send('No questions found for the specified test.');
    } catch (e) {
        logger.error(e);
        res.status(500).send('[QUESTION] Internal Server Error');
    }
});


// GET /question/:test_id/:question_id - Get a specific question for a test
router.get('/:test_id/:question_id', async (req, res) => {
    const { test_id, question_id } = req.params;

    try {
        const baseQuestionQuery = `
            SELECT 
                q.*,
                qt.type_name
            FROM questions q
            INNER JOIN question_type qt ON q.question_type = qt.type_id
            WHERE q.test_id = ? AND q.question_id = ?`;

        const [baseQuestion] = await promisePool.query(baseQuestionQuery, [test_id, question_id]);

        if (baseQuestion.length === 0) {
            return res.status(404).send('Question not found for the specified test.');
        }

        let detailedQuestion = baseQuestion[0];

        switch (detailedQuestion.type_name.toLowerCase()) {
            case 'code':
                const codeQuestionQuery = `
                    SELECT
                        public_test_case,
                        allowed_languages
                    FROM code_questions WHERE question_id = ?
                `;

                const [codeDetails] = await promisePool.query(codeQuestionQuery, [question_id]);

                detailedQuestion = { ...detailedQuestion, ...codeDetails[0] };
                break;

            case 'mcq':
                const mcqQuestionQuery = `
                    SELECT
                        mcq_question_id,
                        multiple_correct
                    FROM mcq_questions WHERE question_id = ?
                `;
                let [mcqDetails] = await promisePool.query(mcqQuestionQuery, [question_id]);

                const mcqOptionsQuery = `
                    SELECT
                        option_text,
                        mcq_option_id
                    FROM mcq_options WHERE mcq_question_id = ?
                `;
                const [mcqOptions] = await promisePool.query(mcqOptionsQuery, [mcqDetails[0].mcq_question_id]);

                delete mcqDetails[0].mcq_question_id;

                detailedQuestion = { ...detailedQuestion, ...mcqDetails[0], options: mcqOptions };
                break;

            // Future case for different question types
            // case 'multiple choice':
            //     // Fetch details specific to multiple choice questions
            //     break;
            // Add more cases as you introduce more question types
        }

        res.json(detailedQuestion);
    } catch (e) {
        logger.error(e);
        res.status(500).send('[QUESTIONS] Internal Server Error');
    }
});

// POST /question/add-code - Add a code question to a test
router.post('/add-code', async (req, res) => {
    const { test_id, question, question_title, solution_code, allowed_languages, public_test_case, private_test_case, marks } = req.body;

    try {
        const questionTypeQuery = `SELECT type_id FROM question_type WHERE type_name = "code"`;
        const [questionTypeResult] = await promisePool.query(questionTypeQuery);

        const question_type = questionTypeResult[0].type_id;


        const insertQuestionQuery = `
            INSERT INTO questions (test_id, question_type, question, question_title, marks)
            VALUES (?, ?, ?, ?, ?)`;

        const [questionResult] = await promisePool.query(insertQuestionQuery, [test_id, question_type, question, question_title, marks]);

        const question_id = questionResult.insertId;

        let insertFields = [];
        let placeholders = [];
        let queryParams = [];

        if (solution_code !== undefined) {
            insertFields.push('solution_code');
            placeholders.push('?');
            queryParams.push(solution_code);
        }

        if (allowed_languages !== undefined) {
            insertFields.push('allowed_languages');
            placeholders.push('?');
            queryParams.push(JSON.stringify(allowed_languages));
        }

        if (public_test_case !== undefined) {
            insertFields.push('public_test_case');
            placeholders.push('?');
            queryParams.push(JSON.stringify(public_test_case));
        }

        if (private_test_case !== undefined) {
            insertFields.push('private_test_case');
            placeholders.push('?');
            queryParams.push(JSON.stringify(private_test_case));
        }

        if (insertFields.length === 0) {
            return res.status(400).send({ error: 'No code question fields provided' });
        }

        queryParams.unshift(question_id);
        insertFields.unshift('question_id');
        placeholders.unshift('?');

        const insertCodeQuestionQuery = `
            INSERT INTO code_questions (${insertFields.join(', ')})
            VALUES (${placeholders.join(', ')})`;

        await promisePool.query(insertCodeQuestionQuery, queryParams);

        res.status(201).send({ message: 'Code question added successfully', question_id: question_id });
    } catch (e) {
        logger.error(e);
        res.status(500).send('[ADD CODE QUESTION] Internal Server Error');
    }
});

// POST /question/add-code - Add a mcq question to a test
router.post('/add-mcq', async (req, res) => {

    const requestBody = req.body;

    const { test_id, question_type, question, options, marks } = requestBody;

    try {
        const questionTypeQuery = `SELECT type_id FROM question_type WHERE type_name = "mcq"`;
        const [questionTypeResult] = await promisePool.query(questionTypeQuery);

        const insertQuestionQuery = `
            INSERT INTO questions (test_id, question_type, question, marks)
            VALUES (?, ?, ?, ?)`;

        const [questionResult] = await promisePool.query(insertQuestionQuery, [test_id, questionTypeResult[0].type_id, question, marks]);

        const question_id = questionResult.insertId;

        const insertMCQQuestionQuery = `
            INSERT INTO mcq_questions (question_id, multiple_correct)
            VALUES (?, ?)
        `;

        // question_type is a numeric value that determines the type of MCQ question
        // 0 => Single Correct
        // 1 => Multi Correct

        const [mcqQuestionReqult] = await promisePool.query(insertMCQQuestionQuery, [question_id, question_type]);

        const mcq_id = mcqQuestionReqult.insertId;

        let insertOptionsQuery = 'INSERT INTO mcq_options (mcq_question_id, option_text, is_correct) VALUES ';
        let insertOptionsValues = [];

        options.forEach((option) => {
            insertOptionsValues.push(`(${mcq_id}, "${option.value}", ${option.correct})`);
        });

        insertOptionsQuery += insertOptionsValues.join(', ');

        await promisePool.query(insertOptionsQuery);

        res.status(201).send({ message: 'MCQ question added successfully', question_id: question_id });
    } catch (e) {
        logger.error(e);
        res.status(500).send('[ADD MCQ QUESTION] Internal Server Error');
    }
});

export default router;
