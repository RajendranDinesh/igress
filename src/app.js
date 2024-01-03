import express from 'express';
import cors from 'cors';

import submissionRouter from './routes/submission.js';
import questionRouter from './routes/questions.js';

const app = express();

const corsOptions = {
    credentials: true,
    origin: ['http://127.0.0.1:3000', 'http://localhost:3000']
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/submission', submissionRouter);
app.use('/api/question', questionRouter);

export default app;