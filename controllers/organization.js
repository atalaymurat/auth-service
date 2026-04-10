const Organization = require("../models/Organization");
const User = require("../models/User");
const { createToken } = require("../utils/jwt");
const offerDefaultsSeed = require("../utils/offerDefaultsSeed");
const logger = require("../utils/logger");

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
      offerDefaults: offerDefaultsSeed,
    });

    // User'ın orgId ve orgRole'ünü güncelle
    await User.findByIdAndUpdate(userId, { orgId: org._id, orgRole: "owner" });

    // Yeni token üret (orgId dahil)
    const updatedUser = await User.findById(userId);
    const token = createToken(updatedUser);

    logger.info({ message: "Org created", orgId: org._id, name });
    res.json({ org, token });
  } catch (err) {
    logger.error({ message: "Org creation failed", error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// GET /api/org/me
const getMyOrg = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.orgId).lean();
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });

    const userIds = org.members.map((m) => m.userId);
    const users = await User.find({ _id: { $in: userIds } }).select("_id name email").lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    org.members = org.members.map((m) => ({
      ...m,
      name: userMap[m.userId.toString()]?.name || "",
      email: userMap[m.userId.toString()]?.email || "",
    }));

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

    logger.info({ message: "Member invited", orgId: org._id, email });
    res.json({ message: "Üye eklendi.", org });
  } catch (err) {
    logger.error({ message: "Member invite failed", error: err.message });
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

    logger.info({ message: "Member role updated", userId: req.params.userId, role });
    res.json({ message: "Rol güncellendi.", org });
  } catch (err) {
    logger.error({ message: "Role update failed", error: err.message });
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/org/update
const updateOrg = async (req, res) => {
  try {
    const { name, logo, phone, email, address, website, taxNo } = req.body;
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });

    const callerRole = org.members.find(m => m.userId.toString() === req.user._id.toString())?.role;
    if (callerRole !== "owner" && callerRole !== "admin") {
      return res.status(403).json({ message: "Yetersiz yetki." });
    }

    if (name) org.name = name;
    if (logo !== undefined) org.logo = logo;
    if (phone !== undefined) org.phone = phone;
    if (email !== undefined) org.email = email;
    if (address !== undefined) org.address = address;
    if (website !== undefined) org.website = website;
    if (taxNo !== undefined) org.taxNo = taxNo;

    await org.save();
    res.json({ message: "Güncellendi.", org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/org/:id/offer-defaults
const updateOfferDefaults = async (req, res) => {
  try {
    const { offerDefaults } = req.body;
    if (!Array.isArray(offerDefaults)) {
      return res.status(400).json({ message: "offerDefaults bir dizi olmalıdır." });
    }

    for (const term of offerDefaults) {
      if (Array.isArray(term.options) && term.options.length > 10) {
        return res.status(400).json({ message: `'${term.key}' için options dizisi en fazla 10 eleman içerebilir.` });
      }
    }

    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { offerDefaults },
      { new: true, runValidators: true }
    );
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });

    res.json({ message: "Güncellendi.", org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/org/:id/bank-accounts
const updateBankAccounts = async (req, res) => {
  try {
    const { bankAccounts } = req.body;
    if (!Array.isArray(bankAccounts)) {
      return res.status(400).json({ message: "bankAccounts bir dizi olmalıdır." });
    }

    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { bankAccounts },
      { new: true, runValidators: true }
    );
    if (!org) return res.status(404).json({ message: "Organizasyon bulunamadı." });

    res.json({ message: "Güncellendi.", org });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createOrg, getMyOrg, inviteMember, updateMemberRole, updateOrg, updateOfferDefaults, updateBankAccounts };
