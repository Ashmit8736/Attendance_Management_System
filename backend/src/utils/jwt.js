const jwt = require('jsonwebtoken');
const env = require('../config/env');

const generateToken = (payload) => {
  return jwt.sign(payload, env.JWT.secret, {
    expiresIn: env.JWT.expiresIn,
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.JWT.secret);
};

module.exports = {
  generateToken,
  verifyToken,
};
