import http from 'http';
import dotenv from 'dotenv';
import path from 'path';

import app from './src/app.js';

dotenv.config({ path: path.join('/home/ubuntu/igress/', '.env') });

const port = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    });