# Usage of logger
```
import { Logger } from "logger.js";
const logger = new Logger();

logger.info("Info") / logger.error("Possible errors") / logger.debug("instead of console.log")
```

# Tips
## Before inserting date into db convert it using the following code
```
moment(<your_date>).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
```