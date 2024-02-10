import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth.js';
import classroomRouter from './routes/classroom.js';
import questionRouter from './routes/questions.js';
import submissionRouter from './routes/submission.js';
import testRouter from './routes/test.js';
import supervisorRouter from './routes/supervisor.js';

const app = express();

const corsOptions = {
    credentials: true,
    origin: ['http://127.0.0.1:3000', 'http://localhost:3000', process.env.FRONTEND_URL],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/auth', authRouter);
app.use('/api/classroom', classroomRouter);
app.use('/api/question', questionRouter);
app.use('/api/submission', submissionRouter);
app.use('/api/test', testRouter);
// app.use('/api/supervisor', supervisorRouter);
app.use(supervisorRouter);

export default app;
