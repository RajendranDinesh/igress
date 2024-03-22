import express from 'express';
import cors from 'cors';
import expressStatusMonitor from 'express-status-monitor';

import authRouter from './routes/auth.js';
import classroomRouter from './routes/classroom.js';
import questionRouter from './routes/questions.js';
import submissionRouter from './routes/submission.js';
import testRouter from './routes/test.js';
import supervisorRouter from './routes/supervisor.js';
import studentRouter from './routes/student.js';

const app = express();

const corsOptions = {
    credentials: true,
    origin: ['http://127.0.0.1:3000', 'http://localhost:3000', process.env.FRONTEND_URL],
};

app.use(expressStatusMonitor());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRouter);
app.use('/api/classroom', classroomRouter);
app.use('/api/question', questionRouter);
app.use('/api/submission', submissionRouter);
app.use('/api/test', testRouter);
app.use('/api/supervisor', supervisorRouter);
app.use('/api/student', studentRouter);

app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
});

// export app

export default app;