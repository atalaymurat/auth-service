const jwt = require("jsonwebtoken");

// Payload'u dışarıdan al, sadece imzala
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  });

const createRefreshToken = (user) =>
  jwt.sign(
    { _id: user._id, applicationId: user.applicationId },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = { signAccessToken, createRefreshToken, verifyToken };
