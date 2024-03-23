# .env
```
PORT=""
DB_HOST=""
DB_NAME=""
DB_PASS=""
DB_USER=""
RAPIDAPI_KEY=""
JWT_SECRET=""
FRONTEND_URL=""
NODE_ENV="dev" | "prod"
```

# Usage of logger
```js
import { Logger } from "logger.js";
const logger = new Logger();

logger.info("Info") / logger.error("Possible errors") / logger.debug("instead of console.log")
```

# Best to know

### Judge0
- [Judge0](https://ce.judge0.com/) is a free judge for running code snippets and we are using it for running code snippets through RapidAPI.
- If hosting on it on our own configure the server's IP inside `./src/config/networking.js` file.

### Before inserting date into db convert it using the following code
```js
moment(<your_date>).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
```