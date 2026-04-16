const express = require("express");
const router = express.Router();
const { login, logout, verify, refresh, healthCheck, switchOrg } = require("../controllers/auth");
const internalAuth = require("../middleware/internalAuth");
const { verifyJwt } = require("../middleware/verifyJwt");
const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

// POST /login – Firebase ID token ile giriş ve JWT oluşturma
router.post("/login", login);

// POST /verify – JWT geçerli mi? Token'dan kimlik çözümleme
router.post("/verify", verify);
router.post("/logout", logout);
router.post("/refresh", refresh);

// GET /health – Sağlık kontrolü
router.get("/health", healthCheck);

// POST /switch-org – Aktif org'u değiştir, yeni JWT üret
router.post("/switch-org", verifyJwt, switchOrg);

// GET /users – Superadmin atama ekranı için tüm kullanıcılar (internal only)
router.get("/users", internalAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    let query = {};
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded.applicationId) query.applicationId = decoded.applicationId;
      } catch {
        query = {};
      }
    }

    const users = await User.find(query)
      .sort({ name: 1, createdAt: -1 })
      .select("_id name email roles defaultOrgId isActive applicationId")
      .lean();

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
