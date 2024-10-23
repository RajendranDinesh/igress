import express from 'express';

import { Logger } from '../utils/logger.js';

import { Request, SetHeader } from '../config/networking.js';

import authenticate from '../utils/auth.js';
import promisePool from '../config/db.js';

const router = express.Router();
const logger = new Logger();

async function getSubmissionId(sourceCode, classroomTestId, studentId) {
    const [submissionId] = await promisePool.query(`
        SELECT submission_id
        FROM code_submissions
        WHERE classroom_test_id = ?
        AND student_id = ? AND source_code = ? ORDER BY submission_id DESC LIMIT 1;
        `, [parseInt(classroomTestId), parseInt(studentId), sourceCode.trim()]);

    return submissionId[0].submission_id;
}

async function getSubmissions(tokens) {
    SetHeader('content-type', 'application/json');

    // Comment these if using local server
    SetHeader('X-RapidAPI-Key', process.env.RAPIDAPI_KEY);
    SetHeader('X-RapidAPI-Host', 'judge0-ce.p.rapidapi.com');

    try {

        if (!tokens) {
            throw Error("Token not found..")
        }

        let tokenArray = tokens.split(',');

        const LENGTH = tokenArray.length;

        let result = [];

        // judge0 could only return batches of 20 submissions so we have to request for submissions in seperate batches...

        if (LENGTH < 20) {
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
    
            return submissions;
        } else {
            let rem = (LENGTH)%20;

            let count = Math.floor(LENGTH/20);

            if (rem > 0) count++;

            for (let i = 0; i < count; i++) {

                const params = {
                    tokens: tokenArray.slice(i*20, (i+1)*20).join(','),
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

                result = result.concat(submissions);
            }
        }

        return result;
        
    } catch (error) {
        logger.error(error)
        return [];
    }
}

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

            if (!questionId || !classroomTestId) throw new Error("ClassroomTestId was not provided");

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
        logger.error(error);
        res.status(500).send(error)
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
            fields: 'time,memory,status',
            base64_encoded: true,
        }

        const response = await Request(
            'GET',
            'submissions/batch',
            null,
            params
        )

        let { submissions } = response.data;

        res.status(200).send({ submissions, created_at: submission[0].created_at, source_code: submission[0].source_code, language_id: submission[0].language });
    } catch (err) {
        logger.error(err);
        res.status(500).send(err);
    }
});


router.post('/submit/:classroomTestId', authenticate(['staff', 'student']), async (req, res) => {
    try {

        const { classroomTestId } = req.params;

        const { mcqAnswers } = req.body;

        const studentId = req.userData.userId;

        const [jTokens] = await promisePool.query(`
            SELECT question_id, submission_id, j_tokens
            FROM code_submissions
            WHERE classroom_test_id = ?
            AND student_id = ?;
            `, [parseInt(classroomTestId), parseInt(studentId)]);

        if (jTokens && jTokens.length > 0) {

            let tokens = '';

            let N = jTokens.length;

            for (let index = 0; index < N; index++) {
                if (index != 0) tokens += `,${atob(jTokens[index].j_tokens)}`;
                else tokens = atob(jTokens[index].j_tokens);
            }
        
            const submissions = await getSubmissions(tokens);

            if (submissions.length === 0) {
                throw new Error("Could not retrieve submissions.");
            }

            let tokenArray = tokens.split(',');
            let index = 0;

            for (const submission of submissions) {
                const submissionId = await getSubmissionId(submission.source_code, classroomTestId, studentId);

                await promisePool.query(`
                    INSERT INTO code_submission_result (submission_id, status, time, memory, j_token) VALUES (?, ?, ?, ?, ?)
                    `, [
                        submissionId,
                        submission.status.description,
                        submission.time,
                        submission.memory,
                        tokenArray[index]
                ]);

                index += 1;
            }

            for (const submission of jTokens) {
                const [submissions] = await promisePool.query(`
                    SELECT status FROM code_submission_result
                    WHERE submission_id = ?
                `, [submission.submission_id]);

                let [marks] = await promisePool.query(`
                    SELECT marks FROM questions
                    WHERE question_id = ?
                `, [submission.question_id]);

                marks = marks[0].marks;

                submissions.forEach(submission => {
                    if (submission.status != 'Accepted') marks = 0;
                });

                await promisePool.query(`
                    UPDATE code_submissions SET marks_awarded = ?
                    WHERE submission_id = ?
                `, [marks, submission.submission_id]);
            }
        }

        if (mcqAnswers && mcqAnswers.length > 0) {
            mcqAnswers.forEach(async (mcqAnswer) => {
                const answerIds = mcqAnswer.answer;
                const questionId = mcqAnswer.question_id;
                let temp = answerIds.split(',');
        
                // Get the mcq_question_id, multiple_correct flag, and total marks for the question
                const [mcqQuestions] = await promisePool.query(`
                    SELECT mq.mcq_question_id, mq.multiple_correct, q.marks
                    FROM mcq_questions mq
                    JOIN questions q ON mq.question_id = q.question_id
                    WHERE mq.question_id = ?`, [questionId]);
                
                const mcqQuestionId = mcqQuestions[0].mcq_question_id;
                const multipleCorrect = mcqQuestions[0].multiple_correct;
                const totalMarks = mcqQuestions[0].marks;
        
                // Get the correct options for the question
                const [correctOptions] = await promisePool.query(`
                    SELECT mcq_option_id FROM mcq_options
                    WHERE mcq_question_id = ? AND is_correct = 1`, [mcqQuestionId]);
        
                const correctOptionIds = correctOptions.map(option => option.mcq_option_id);
                const totalCorrectAnswers = correctOptionIds.length;
        
                // Calculate marks awarded
                let marksAwarded = 0;
        
                if (multipleCorrect) {
                    // If multiple correct answers are allowed, calculate partial marks based on the number of correct answers provided
                    const correctAnswersProvided = temp.filter(answerId => correctOptionIds.includes(parseInt(answerId))).length;
                    marksAwarded = (correctAnswersProvided / totalCorrectAnswers) * totalMarks;
                } else {
                    // If only one correct answer is allowed, check if the first provided answer is correct
                    const isCorrect = correctOptionIds.includes(parseInt(temp[0]));
                    marksAwarded = isCorrect ? totalMarks : 0;
                }
        
                // Insert each answer with the calculated marks
                temp.forEach(async (answerId) => {
                    if (answerId.length > 0) {
                        await promisePool.query(`
                            INSERT INTO mcq_submissions(student_id, mcq_question_id, mcq_option_id, classroom_test_id, marks_awarded)
                            VALUES(?, ?, ?, ?, ?)`,
                            [studentId, mcqQuestionId, parseInt(answerId), parseInt(classroomTestId), marksAwarded]
                        );
                    }
                });
            });
        }

        res.status(200).send("Done mf");

    } catch (error) {
        logger.error(error);
        res.status(500).send(error.toString());
    }
});

export default router;
