import express from 'express';

import { Logger } from '../utils/logger.js';

import { Request, SetHeader } from '../config/networking.js';

import authenticate from '../utils/auth.js';
import promisePool from '../config/db.js';

const router = express.Router();
const logger = new Logger();

router.get('/', authenticate(['staff','admin', 'student']), async (req, res) => {

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

router.post('/', authenticate(['staff','admin', 'student']), async (req, res) => {
    SetHeader('content-type', 'application/json');

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    // Comment this if using remote server
    SetHeader('X-Auth-User', 'dineshpr');

    try {
        const test_cases = req.body.test_case;
        const userId = req.userData.userId;
        const questionId = 17; // caution here
        const languageId = req.body.language_id;
        const sourceCode = btoa(req.body.source_code);

        const submissions = [];

        test_cases.forEach((testCase) => {
            const submission = {
                language_id: languageId,
                source_code: sourceCode,
                stdin: btoa(testCase.input),
                stdout: btoa(testCase.output),
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
            language: languageId,
            source_code: sourceCode,
            j_tokens: btoa(tokens),
        }

        const [submission] = await promisePool.query(`INSERT INTO code_submissions SET ?`, dbInsertValues);

        const submissionId = submission.insertId;

        res.status(201).send({ tokens });
    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

export default router;
