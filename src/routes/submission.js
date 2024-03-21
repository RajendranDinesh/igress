import express from 'express';

import { Logger } from '../utils/logger.js';

import { Request, SetHeader } from '../config/networking.js';

import authenticate from '../utils/auth.js';
import promisePool from '../config/db.js';

const router = express.Router();
const logger = new Logger();

router.get('/', authenticate(['staff', 'admin', 'student']), async (req, res) => {

    SetHeader('content-type', 'application/json');

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    try {

        const tokens = req.query.tokens;

        if (!tokens) {
            throw Error("Token not found..")
        }

        const params = {
            tokens: tokens,
            fields: 'source_code,language_id,stdin,expected_output,stdout,stderr,compile_output,time,memory,status',
            base64_encoded: true,
        }

        const response = await Request(
            'GET',
            'submissions/batch',
            null,
            params
        )

        const { submissions } = response.data;

        res.status(200).send({ submissions });
    } catch (error) {
        logger.error(error)
        res.status(500).send(error);
    }
});

router.post('/', authenticate(['staff', 'admin', 'student']), async (req, res) => {
    SetHeader('content-type', 'application/json');

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    // Comment this if using remote server
    SetHeader('X-Auth-User', 'dineshpr');

    try {
        let test_cases = req.body.test_case;
        const userId = req.userData.userId;
        const languageId = req.body.language_id;
        const sourceCode = btoa(req.body.source_code);

        if (req.body.question_id) {
            const questionId = req.body.question_id;
            const classroomTestId = req.body.classroom_test_id;

            const [privateTestCases] = await promisePool.query(`
                SELECT private_test_case FROM code_questions
                WHERE question_id = ?`, [questionId]
            );

            if (privateTestCases[0].private_test_case) {
                test_cases = privateTestCases[0].private_test_case;
            }

            const submissions = [];

            test_cases.forEach((testCase) => {
                const submission = {
                    language_id: languageId,
                    source_code: sourceCode,
                    stdin: btoa(testCase.input),
                    expected_output: btoa(testCase.output)
                };

                submissions.push(submission);
            });

            const body = {
                submissions,
            };

            const params = {
                base64_encoded: true,
            };

            const response = await Request(
                'POST',
                'submissions/batch',
                body,
                params
            );

            const tokens = response.data.map((submission) => submission.token);

            const dbInsertValues = {
                student_id: userId,
                question_id: questionId,
                classroom_test_id: classroomTestId,
                language: languageId,
                source_code: sourceCode,
                j_tokens: btoa(tokens),
            }

            const [submission] = await promisePool.query(`
                INSERT INTO code_submissions(student_id, question_id, classroom_test_id, language, source_code, j_tokens)
                VALUES(?, ?, ?, ?, ?, ?)`,
                [
                    dbInsertValues.student_id,
                    dbInsertValues.question_id,
                    dbInsertValues.classroom_test_id,
                    dbInsertValues.language,
                    dbInsertValues.source_code,
                    dbInsertValues.j_tokens
                ]
            );

            const submissionId = submission.insertId;

            res.status(201).send({ submissionId });
        } else {
            const submissions = [];

            test_cases.forEach((testCase) => {
                const submission = {
                    language_id: languageId,
                    source_code: sourceCode,
                    stdin: btoa(testCase.input),
                    expected_output: btoa(testCase.output)
                };

                submissions.push(submission);
            });

            const body = {
                submissions,
            };

            const params = {
                base64_encoded: true,
            };

            const response = await Request(
                'POST',
                'submissions/batch',
                body,
                params
            );

            const tokens = response.data.map((submission) => submission.token);

            res.status(201).send({ tokens });
        }
    } catch (err) {
        logger.error(err);
        res.status(500).send(err);
    }
});

router.get('/get-all/:classroomTestId', authenticate(['staff', 'admin', 'student']), async (req, res) => {
    try {
        const classroomTestId = req.params.classroomTestId;
        const userId = req.userData.userId;

        const [submissions] = await promisePool.query(`
            SELECT * FROM code_submissions
            WHERE student_id = ? AND classroom_test_id = ?`, [userId, classroomTestId]
        );

        res.status(200).send({ submissions });
    } catch (error) {
        logger.error(err);
        res.status(500).send(err)
    }
});

router.get('/id/:currentSubId', authenticate(['staff', 'admin', 'student']), async (req, res) => {
    try {
        SetHeader('content-type', 'application/json');

        // Comment these if using local server
        SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
        SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

        // Comment this if using remote server
        SetHeader('X-Auth-User', 'dineshpr');

        const currentSubId = req.params.currentSubId;

        const [submission] = await promisePool.query(`
            SELECT * FROM code_submissions
            WHERE submission_id = ?`, [currentSubId]
        )

        const jTokens = atob(submission[0].j_tokens);

        const params = {
            tokens: jTokens,
            fields: 'source_code,language_id,time,memory,status',
            base64_encoded: true,
        }

        const response = await Request(
            'GET',
            'submissions/batch',
            null,
            params
        )

        const { submissions } = response.data;

        res.status(200).send({ submissions, created_at: submission[0].created_at });
    } catch (err) {
        logger.error(err);
        res.status(500).send(err);
    }
});

export default router;
