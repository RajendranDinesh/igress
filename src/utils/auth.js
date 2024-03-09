import jwt from "jsonwebtoken";

import promisePool from "../config/db.js";

const authenticate = (allowedRoles = ['student']) => {
    return async (req, res, next) => {
        try {
            const token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;

            const query = `
                SELECT r.role_name FROM user_roles ur
                JOIN roles r ON ur.role_id = r.role_id
                WHERE ur.user_id = ?
            `;

            const [roles] = await promisePool.execute(query, [userId]);

            const userRoles = roles.map(role => role.role_name);

            const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));

            if (!hasAllowedRole) {
                return res.status(403).send({ message: 'Access denied' });
            }

            req.userData = decoded;
            req.userRoles = userRoles;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(498).send({ message: '[AUTH] Token expired' });
            } else if (error.code === "ETIMEDOUT") {
                return res.status(401).send({ message: '[AUTH] DB Connection failed' });
            }

            return res.status(401).send({ message: '[AUTH] Verification failed' });
        }
    };
};


export default authenticate;