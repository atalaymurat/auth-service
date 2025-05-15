const express = require("express");
const router = express.Router();
const { login, verify, healthCheck } = require("../controllers/auth");

// POST /login – Firebase ID token ile giriş ve JWT oluşturma
router.post("/login", login);

// POST /verify – JWT geçerli mi? Token'dan kimlik çözümleme
router.post("/verify", verify);

// GET /health – Sağlık kontrolü
router.get("/health", healthCheck);

module.exports = router;