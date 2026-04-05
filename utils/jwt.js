const jwt = require("jsonwebtoken");

const TOKEN_PAYLOAD = (user) => ({
  _id: user._id,
  email: user.email,
  roles: user.roles,
  applicationId: user.applicationId,
  orgId: user.orgId || null,
  orgRole: user.orgRole || null,
});

const createToken = (user) =>
  jwt.sign(TOKEN_PAYLOAD(user), process.env.JWT_SECRET, { expiresIn: "15m" });

const createRefreshToken = (user) =>
  jwt.sign({ _id: user._id, applicationId: user.applicationId }, process.env.JWT_SECRET, { expiresIn: "30d" });

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = { createToken, createRefreshToken, verifyToken };
