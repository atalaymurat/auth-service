const express = require("express");
const router = express.Router();
const { login, logout, verify, refresh, healthCheck } = require("../controllers/auth");
const internalAuth = require("../middleware/internalAuth");
const User = require("../models/User");

// POST /login – Firebase ID token ile giriş ve JWT oluşturma
router.post("/login", login);

// POST /verify – JWT geçerli mi? Token'dan kimlik çözümleme
router.post("/verify", verify);
router.post("/logout", logout);
router.post("/refresh", refresh);

// GET /health – Sağlık kontrolü
router.get("/health", healthCheck);

// GET /users/summary – Superadmin için kullanıcı özeti (internal only)
router.get("/users/summary", internalAuth, async (req, res) => {
  try {
    const total = await User.countDocuments();
    const recent = await User.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .select("name email roles createdAt");
    res.json({ success: true, total, recent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;