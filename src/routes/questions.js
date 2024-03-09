import express from 'express';
import multer from 'multer';

import promisePool from '../config/db.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger();

// GET /question/:test_id - Get all questions for a test
router.get('/:test_id', async (req, res) => {
    const { test_id } = req.params;

    try {
        const query = `
            SELECT 
                q.question_id,
                q.question_title,
                qt.type_name, 
                q.created_at, 
                q.updated_at
            FROM questions q
            INNER JOIN question_type qt ON q.question_type = qt.type_id
            WHERE q.test_id = ?
            ORDER BY q.question_id ASC;`;

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
                const codeQuestionQuery = `SELECT * FROM code_questions WHERE question_id = ?`;
                const [codeDetails] = await promisePool.query(codeQuestionQuery, [question_id]);
                detailedQuestion = { ...detailedQuestion, ...codeDetails[0] };
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
    const { test_id, question_type, question, question_title, starter_code, allowed_languages, input_specification, output_specification, public_test_case, private_test_case } = req.body;

    try {
        const insertQuestionQuery = `
            INSERT INTO questions (test_id, question_type, question, question_title)
            VALUES (?, ?, ?, ?)`;

        const [questionResult] = await promisePool.query(insertQuestionQuery, [test_id, question_type, question, question_title]);
        
        const question_id = questionResult.insertId;

        let insertFields = [];
        let placeholders = [];
        let queryParams = [];

        if (starter_code !== undefined) {
            insertFields.push('starter_code');
            placeholders.push('?');
            queryParams.push(starter_code);
        }

        if (allowed_languages !== undefined) {
            insertFields.push('allowed_languages');
            placeholders.push('?');
            queryParams.push(JSON.stringify(allowed_languages));
        }

        if (input_specification !== undefined) {
            insertFields.push('input_specification');
            placeholders.push('?');
            queryParams.push(input_specification);
        }

        if (output_specification !== undefined) {
            insertFields.push('output_specification');
            placeholders.push('?');
            queryParams.push(output_specification);
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
router.post('/add-mcq', multer().single('question_image'), async (req, res) => {

    const imageBuffer = req.file ? req.file.buffer : null;

    const base64Image = imageBuffer ? imageBuffer.toString('base64') : null;

    const requestBody = JSON.parse(req.body.question_data);

    const { test_id, question_type, question, options } = requestBody;

    try {
        const questionTypeQuery = `SELECT type_id FROM question_type WHERE type_name = ?`;
        const [questionTypeResult] = await promisePool.query(questionTypeQuery, ['mcq']);

        const insertQuestionQuery = `
            INSERT INTO questions (test_id, question_type, question)
            VALUES (?, ?, ?)`;

        const [questionResult] = await promisePool.query(insertQuestionQuery, [test_id, questionTypeResult[0].type_name, question]);
        
        const question_id = questionResult.insertId;

        const insertMCQQuestionQuery = `
            INSERT INTO mcq_questions (question_id, multiple_correct)
            VALUES (?, ?)`;

        const [mcqQuestionReqult] = await promisePool.query(insertMCQQuestionQuery, [question_id, question_type]);

        const mcq_id = mcqQuestionReqult.insertId;

        let insertOptionsQuery = 'INSERT INTO mcq_options (mcq_question_id, option_text, is_correct) VALUES ';
        let insertOptionsValues = [];

        options.forEach((option) => {
            insertOptionsValues.push(`(${mcq_id}, "${option.value}", ${option.correct})`);
        });

        insertOptionsQuery += insertOptionsValues.join(', ');

        res.status(201).send({ message: 'MCQ question added successfully', question_id: question_id });
    } catch (e) {
        logger.error(e);
        res.status(500).send('[ADD MCQ QUESTION] Internal Server Error');
    }
});

export default router;
