import express from 'express';

import { Logger } from '../utils/logger.js';

import { Request, SetHeader } from '../config/networking.js';

import promisePool from '../config/db.js';
import authenticate from '../utils/auth.js';

const router = express.Router();
const logger = new Logger();

router.get('/', async (req, res) => {

    const submission_id = req.body.submission_id;
    // const submission_id = 3;

    SetHeader('content-type', 'application/json');

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    try {

        if (!req.query.tokens) {
            throw Error("Token not found..")
        }

        const params = {
            tokens: req.query.tokens,
            fields: 'source_code,language_id,stdin,expected_output,stdout,time,memory,status',
            base64_encoded: true,
        };

        const response = await Request(
            'GET',
            'submissions/batch',
            null,
            params
        );

        if (submission_id) {

            const { submissions } = response.data;

            const insertSql = `
                INSERT INTO submission_results (submission_id, status, Execution_time, Memory_usage, tokens)
                VALUES (?, ?, ?, ?, ?)
            `;

            const promises = submissions.map(async(submission, index) => {
                const values = [
                    submission_id,
                    submission.status['description'],
                    submission.time,
                    submission.memory,
                    tokens[index]
                ];
                
                await promisePool.execute(insertSql, values);
            });

            await Promise.all(promises);
        }


        res.status(200).send({ submissions });
    } catch (error) {
        logger.error(error)
        res.status(500).send(error);
    }
});

router.post('/',authenticate(['staff','admin', 'student']), async (req, res) => {
    SetHeader('content-type', 'application/json');

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    // Comment this if using remote server
    SetHeader('X-Auth-User', 'dineshpr');

    try {
        const test_cases = req.body.test_case;

        // const problem_id = req.body.problem_id;
        const problem_id = 1;

        const student_id = req.userData.userId;

        const submissions = [];

        test_cases.forEach((testCase) => {
            const submission = {
                problem_id,
                student_id,
                language_id: req.body.language_id,
                source_code: btoa(req.body.source_code),
                stdin: btoa(testCase.input),
                stdout: btoa(testCase.output),
                expected_output: btoa(testCase.output),
                submission_time: new Date().toISOString()
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

        const insertSql = `
            INSERT INTO submissions (problem_id, student_id, submitted_code, language, stin, stdout,expected_output, submission_time, tokens)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const promises = submissions.map(async(submission) => {
            const values = [
                submission.problem_id,
                submission.student_id,
                submission.source_code,
                submission.language_id,
                submission.stdin,
                submission.stdout,
                submission.expected_output,
                submission.submission_time,
                tokens[0]
            ];
            
            const [result] = await promisePool.execute(insertSql, values);

            const submissionId = result.insertId;

            return submissionId;
        });
        
        const submissionId = await Promise.all(promises);

        res.status(201).send({ tokens , submissionId });
    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

export default router;
