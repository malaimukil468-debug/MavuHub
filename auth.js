const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mavuhub_secret_key_2026';

const verifyToken = (req, res, next) => {
    let token = req.headers['authorization'] || req.headers['x-access-token'];
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }
    if (!token) return res.status(403).json({ message: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized or token expired' });
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Require Admin Role' });
    }
};

module.exports = { verifyToken, isAdmin };
