const verifyFirebaseToken = require("../utils/verifyFirebaseToken");
const { createToken, createRefreshToken, verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const Organization = require("../models/Organization");
const logger = require('../utils/logger');
const offerDefaultsSeed = require("../utils/offerDefaultsSeed");

const login = async (req, res) => {
  try {
    const { idToken, applicationId } = req.body;
    if (!idToken || !applicationId) {
      return res
        .status(400)
        .json({ error: "ID token and applicationId are required" });
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

    // Org yoksa oluştur (yeni kullanıcı veya daha önce org oluşturulamadıysa)
    if (!user.orgId) {
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
          { orgId: org._id, orgRole: "owner" },
          { new: true }
        );
        user.orgId = updated.orgId;
        user.orgRole = updated.orgRole;
        logger.info({ message: "Org created", orgId: org._id, userId: user._id });

        // Yeni org için backend'de örnek veri oluştur (hata olursa sessizce geç)
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
      } catch (orgErr) {
        logger.error({ message: "Org creation failed", error: orgErr.message });
        return res.status(500).json({ error: "Organizasyon oluşturulamadı. Lütfen tekrar deneyin." });
      }
    }

    const accessToken = createToken(user);
    const refreshToken = createRefreshToken(user);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieBase = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      domain: isProduction ? ".postiva.uk" : undefined,
    };

    res.cookie("accessToken", accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", refreshToken, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 * 1000 });

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error({ message: "Auth error", error: error.message, endpoint: "login" });
    return res.status(401).json({ error: "Login failed" });
  }
};

const logout = async (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieBase = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? ".postiva.uk" : undefined,
  };
  res.clearCookie("accessToken", cookieBase);
  res.clearCookie("refreshToken", cookieBase);
  return res.status(200).json({ success: true, message: "Logout successful" });
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });

    const decoded = verifyToken(token);
    const user = await User.findById(decoded._id);
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found" });

    const accessToken = createToken(user);
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      domain: isProduction ? ".postiva.uk" : undefined,
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
      return res
        .status(400)
        .json({ error: "Token and applicationId required" });
    }

    const decoded = verifyToken(token);
    logger.debug({ message: "Token verified", userId: decoded._id });

    const user = await User.findOne({
      _id: decoded._id,
      applicationId: applicationId,
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found or inactive" });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    logger.error({ message: "Auth error", error: err.message, endpoint: "verify" });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const healthCheck = (_req, res) => {
  logger.debug({ message: "Health check" });
  return res.status(200).json({ status: "ok", service: "auth-service" });
};

module.exports = { login, logout, verify, refresh, healthCheck };
