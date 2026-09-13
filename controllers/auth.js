const mongoose = require("mongoose");
const verifyFirebaseToken = require("../utils/verifyFirebaseToken");
const { signAccessToken, createRefreshToken, verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const Organization = require("../models/Organization");
const logger = require('../utils/logger');
const offerDefaultsSeed = require("../utils/offerDefaultsSeed");

// Org membership'ten orgRole çek (async)
const resolveOrgRole = async (userId, orgId) => {
  if (!orgId) return null;
  const org = await Organization.findById(orgId).select("members");
  const membership = org?.members?.find(
    (m) => m.userId.toString() === userId.toString()
  );
  return membership?.role || null;
};

const cookieBase = (isProduction) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  domain: isProduction ? process.env.COOKIE_DOMAIN || ".postiva.uk" : undefined,
});

const login = async (req, res) => {
  try {
    const { idToken, applicationId } = req.body;
    if (!idToken || !applicationId) {
      return res.status(400).json({ error: "ID token and applicationId are required" });
    }

    const decodedToken = await verifyFirebaseToken(idToken);
    if (!decodedToken?.uid) {
      return res.status(401).json({ error: "Invalid Firebase token" });
    }

    const userData = {
      firebaseUid: decodedToken.uid,
      name: decodedToken.name || decodedToken.email?.split("@")[0],
      email: decodedToken.email,
      profilePicture: decodedToken.picture,
      emailVerified: decodedToken.email_verified || false,
      authProvider: decodedToken.firebase?.sign_in_provider || "password",
      applicationId,
    };

    const { user, isNew } = await User.findOrCreate(userData);
    logger.info({ message: "User login", email: user.email, isNew });

    // 1. Fallback: Mongoose şemasında olmayan eski orgId alanını native driver ile oku
    if (!user.defaultOrgId) {
      const rawUser = await mongoose.connection.db
        .collection("users")
        .findOne({ _id: user._id }, { projection: { orgId: 1 } });

      if (rawUser?.orgId) {
        await mongoose.connection.db.collection("users").updateOne(
          { _id: user._id },
          {
            $set: { defaultOrgId: rawUser.orgId },
            $unset: { orgId: "", orgRole: "" },
          }
        );
        user.defaultOrgId = rawUser.orgId;
        logger.info({ message: "Legacy orgId migrated on login", userId: user._id });
      }
    }

    // 2. Hâlâ yoksa — applicationId'de üye olduğu bir org var mı?
    if (!user.defaultOrgId) {
      const existingOrg = await Organization.findOne({
        "members.userId": user._id,
        applicationId: user.applicationId,
      });

      if (existingOrg) {
        const updated = await User.findByIdAndUpdate(
          user._id,
          { defaultOrgId: existingOrg._id },
          { new: true }
        );
        user.defaultOrgId = updated.defaultOrgId;
      } else {
        // 3. Gerçekten hiç yoksa — yeni org yarat
        const baseSlug = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        const slug = `${baseSlug}-${user._id.toString().slice(-6)}`;

        try {
          const org = await Organization.create({
            name: user.name,
            slug,
            applicationId: user.applicationId,
            createdBy: user._id,
            members: [{ userId: user._id, role: "owner" }],
            offerDefaults: offerDefaultsSeed,
          });

          const updated = await User.findByIdAndUpdate(
            user._id,
            { defaultOrgId: org._id },
            { new: true }
          );
          user.defaultOrgId = updated.defaultOrgId;
          logger.info({ message: "Org created", orgId: org._id, userId: user._id });

          setImmediate(async () => {
            try {
              const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:3021";
              const sampleRes = await fetch(`${backendUrl}/api/sample-data/init`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-service-token": process.env.INTERNAL_SERVICE_TOKEN || "",
                },
                body: JSON.stringify({ organizationId: org._id.toString(), userId: user._id.toString() }),
              });
              if (sampleRes.ok) {
                await User.findByIdAndUpdate(user._id, { sampleDataCreated: true });
                logger.info({ message: "Sample data created", orgId: org._id });
              } else {
                const body = await sampleRes.text();
                logger.warn({ message: "Sample data init failed", status: sampleRes.status, body });
              }
            } catch (sampleErr) {
              logger.warn({ message: "Sample data creation failed", error: sampleErr.message });
            }
          });
        } catch (orgErr) {
          logger.error({ message: "Org creation failed", error: orgErr.message });
          return res.status(500).json({ error: "Organizasyon oluşturulamadı. Lütfen tekrar deneyin." });
        }
      }
    }

    const orgRole = await resolveOrgRole(user._id, user.defaultOrgId);

    const payload = {
      _id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      orgId: user.defaultOrgId || null,
      orgRole,
      applicationId: user.applicationId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = createRefreshToken(user);

    const isProduction = process.env.NODE_ENV === "production";
    const base = cookieBase(isProduction);

    res.cookie("accessToken", accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 });

    const userObj = user.toObject();
    userObj.orgRole = orgRole;
    return res.status(200).json({ success: true, user: userObj });
  } catch (error) {
    logger.error({ message: "Auth error", error: error.message, endpoint: "login" });
    return res.status(401).json({ error: "Login failed" });
  }
};

const logout = async (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const base = cookieBase(isProduction);
  res.clearCookie("accessToken", base);
  res.clearCookie("refreshToken", base);
  return res.status(200).json({ success: true, message: "Logout successful" });
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });

    const decoded = verifyToken(token);
    const user = await User.findById(decoded._id);
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found" });

    const orgRole = await resolveOrgRole(user._id, user.defaultOrgId);

    const payload = {
      _id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      orgId: user.defaultOrgId || null,
      orgRole,
      applicationId: user.applicationId,
    };

    const accessToken = signAccessToken(payload);
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("accessToken", accessToken, {
      ...cookieBase(isProduction),
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

const verify = async (req, res) => {
  try {
    const token = req.cookies?.accessToken;
    const { applicationId } = req.body;
    if (!token || !applicationId) {
      return res.status(400).json({ error: "Token and applicationId required" });
    }

    const decoded = verifyToken(token);
    logger.debug({ message: "Token verified", userId: decoded._id });

    const user = await User.findOne({ _id: decoded._id, applicationId });
    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found or inactive" });
    }

    const orgRole = await resolveOrgRole(user._id, user.defaultOrgId);
    const userObj = user.toObject();
    userObj.orgRole = orgRole;
    return res.status(200).json({ success: true, user: userObj });
  } catch (err) {
    logger.error({ message: "Auth error", error: err.message, endpoint: "verify" });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const switchOrg = async (req, res) => {
  try {
    const { orgId } = req.body;
    const userId = req.user._id;

    if (!orgId) {
      return res.status(400).json({ error: "orgId zorunlu" });
    }

    const org = await Organization.findById(orgId).select("members");
    if (!org) {
      return res.status(404).json({ error: "Organizasyon bulunamadı" });
    }

    const membership = org.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (!membership) {
      return res.status(403).json({ error: "Bu organizasyona üye değilsiniz" });
    }

    const user = await User.findById(userId);

    const payload = {
      _id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      orgId,
      orgRole: membership.role,
      applicationId: user.applicationId,
    };

    const accessToken = signAccessToken(payload);
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("accessToken", accessToken, {
      ...cookieBase(isProduction),
      maxAge: 15 * 60 * 1000,
    });

    return res.json({ success: true, orgId, orgRole: membership.role });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const healthCheck = (_req, res) => {
  logger.debug({ message: "Health check" });
  return res.status(200).json({ status: "ok", service: "auth-service" });
};

module.exports = { login, logout, verify, refresh, healthCheck, switchOrg };
