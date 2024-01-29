import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.logFile = path.join(__dirname, 'app.log');
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} [${level}] ${message}\n`;
        fs.appendFileSync(this.logFile, logMessage);
        console.log(logMessage.trim());
    }

    info(message) {
        this.log(message, 'INFO');
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    debug(message) {
        this.log(message, 'DEBUG');
    }
}

export { Logger };