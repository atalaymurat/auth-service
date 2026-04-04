const Organization = require("../models/Organization");
const User = require("../models/User");
const { createToken } = require("../utils/jwt");

// POST /api/org/create
const createOrg = async (req, res) => {
  try {
    const { name, slug } = req.body;
    const userId = req.user._id;

    const existing = await Organization.findOne({ slug, applicationId: req.user.applicationId });
    if (existing) return res.status(409).json({ message: "Bu slug zaten kullanımda." });

    const org = await Organization.create({
      name,
      slug,
      applicationId: req.user.applicationId,
      createdBy: userId,
      members: [{ userId, role: "owner" }],
    });

    // User'ın orgId ve orgRole'ünü güncelle
    await User.findByIdAndUpdate(userId, { orgId: org._id, orgRole: "owner" });

    // Yeni token üret (orgId dahil)
    const updatedUser = await User.findById(userId);
    const token = createToken(updatedUser);

    res.json({ org, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/org/me
const getMyOrg = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/org/invite
const inviteMember = async (req, res) => {
  try {
    const { email, role = "member" } = req.body;
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });

    const callerRole = org.members.find(m => m.userId.toString() === req.user._id.toString())?.role;
    if (callerRole !== "owner") return res.status(403).json({ message: "Sadece owner üye ekleyebilir." });

    const invitedUser = await User.findOne({ email, applicationId: req.user.applicationId });
    if (!invitedUser) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const alreadyMember = org.members.some(m => m.userId.toString() === invitedUser._id.toString());
    if (alreadyMember) return res.status(409).json({ message: "Kullanıcı zaten üye." });

    org.members.push({ userId: invitedUser._id, role });
    await org.save();

    await User.findByIdAndUpdate(invitedUser._id, { orgId: org._id, orgRole: role });

    res.json({ message: "Üye eklendi.", org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/org/member/:userId/role
const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });

    const callerRole = org.members.find(m => m.userId.toString() === req.user._id.toString())?.role;
    if (callerRole !== "owner") return res.status(403).json({ message: "Sadece owner rol değiştirebilir." });

    const member = org.members.find(m => m.userId.toString() === req.params.userId);
    if (!member) return res.status(404).json({ message: "Üye bulunamadı." });

    member.role = role;
    await org.save();

    await User.findByIdAndUpdate(req.params.userId, { orgRole: role });

    res.json({ message: "Rol güncellendi.", org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createOrg, getMyOrg, inviteMember, updateMemberRole };
