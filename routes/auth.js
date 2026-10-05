const express = require("express");
const router = express.Router();
const { login, logout, verify, refresh, healthCheck, switchOrg } = require("../controllers/auth");
const internalAuth = require("../middleware/internalAuth");
const { verifyJwt } = require("../middleware/verifyJwt");
const User = require("../models/User");
const Organization = require("../models/Organization");
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ name: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id name email roles defaultOrgId isActive applicationId")
        .lean(),
      User.countDocuments(query),
    ]);

    // Fetch organization names for users with defaultOrgId
    const orgIds = users.filter(u => u.defaultOrgId).map(u => u.defaultOrgId);
    const orgs = await Organization.find({ _id: { $in: orgIds } }).select("_id name").lean();
    const orgMap = new Map(orgs.map(o => [o._id.toString(), o.name]));

    const usersWithOrgName = users.map(u => ({
      ...u,
      organizationName: u.defaultOrgId ? orgMap.get(u.defaultOrgId.toString()) || null : null,
    }));

    res.json({ success: true, users: usersWithOrgName, total });
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

// GET /users/:id – Internal service lookup for document metadata
router.get("/users/:id", internalAuth, async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.query.applicationId) query.applicationId = req.query.applicationId;

    const user = await User.findOne(query)
      .select("_id name email profilePicture roles defaultOrgId applicationId")
      .lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /users/:id/activate – Superadmin: Activate user
router.patch("/users/:id/activate", internalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("_id name email roles isActive").lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Prevent superadmin from being deactivated
    if (user.roles?.includes("superadmin")) {
      return res.status(403).json({ success: false, message: "Superadmin cannot be modified" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select("_id name email isActive").lean();

    logger.info({ message: "User activated", userId: user._id, email: user.email });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /users/:id/deactivate – Superadmin: Deactivate user
router.patch("/users/:id/deactivate", internalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("_id name email roles isActive").lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Prevent superadmin from being deactivated
    if (user.roles?.includes("superadmin")) {
      return res.status(403).json({ success: false, message: "Superadmin cannot be modified" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select("_id name email isActive").lean();

    logger.info({ message: "User deactivated", userId: user._id, email: user.email });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /users/:id – Superadmin: Delete user
router.delete("/users/:id", internalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("_id name email roles").lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Prevent superadmin from being deleted
    if (user.roles?.includes("superadmin")) {
      return res.status(403).json({ success: false, message: "Superadmin cannot be deleted" });
    }

    const deleted = await User.findByIdAndDelete(req.params.id).select("_id name email").lean();

    logger.info({ message: "User deleted", userId: deleted._id, email: deleted.email });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
