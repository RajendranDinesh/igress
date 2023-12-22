import express from 'express';
import { Request, SetHeader } from '../config/networking.js';

const router = express.Router();

router.get('/', async (req, res) => {
    SetHeader('content-type', 'application/json',);

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    try {
        const params = {
            tokens: req.query.tokens,
            fields: "source_code,language_id,stdin,expected_output,stdout,time,memory,status",
            base64_encoded: true,
        }

        const response = await Request('GET', "submissions/batch", null, params);

        const submissions = response.data.submissions;

        res.status(200).send({submissions: submissions});
    } catch (error) {
        console.log(error);
        res.status(500).send();
    }
});

router.post('/', async (req, res) => {

    SetHeader('content-type', 'application/json',);

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    // Comment this if using remote server
    SetHeader("X-Auth-User", "dineshpr")

    try {
        const test_cases = req.body.test_case;

        const submissions = [];

        test_cases.forEach(testCase => {
            const submission = {
                language_id: req.body.language_id,
                source_code: btoa(req.body.source_code),
                stdin: btoa(testCase.input),
                expected_output: btoa(testCase.output),
            }

            submissions.push(submission);
        });

        const body = {
            submissions: submissions
        }

        const params = {
            base64_encoded: true,
        }

        const response = await Request('POST', "submissions/batch", body, params);

        const tokens = response.data.map(submission => submission.token);

        res.status(201).send({tokens: tokens})
    } catch (err) {
        console.log(err);
        res.status(500).send();
    }
});

export default router;