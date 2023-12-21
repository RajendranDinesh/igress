import express from 'express';
import { Request, SetHeader } from '../config/networking.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Hello World!');
});

router.post('/', async (req, res) => {

    SetHeader('content-type', 'application/json',);
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    //get length of test cases and loop through them
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

    console.log(response.data);

    res.status(200).send();
});

export default router;