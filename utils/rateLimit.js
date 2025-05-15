const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // Bu süre içinde maksimum 5 istek
  message: {
    success: false,
    error: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 60, // Her IP için dakikada 60 istek
  message: "Too many requests, please try again later.",
});

module.exports = { loginLimiter, apiLimiter };