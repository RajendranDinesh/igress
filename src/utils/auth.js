import jwt from "jsonwebtoken";

const authenticate = (allowedRoles = ['student']) => {
    return (req, res, next) => {
        try {
            const token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const userRole = decoded.role;
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).send({ message: 'Access denied' });
            }

            req.userData = decoded;

            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(498).send({ message: 'Token expired' });
            }

            return res.status(401).send({ message: 'Authentication failed' });
        }
    }
};

export default authenticate;