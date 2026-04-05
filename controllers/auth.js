const verifyFirebaseToken = require("../utils/verifyFirebaseToken");
const { createToken, createRefreshToken, verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const Organization = require("../models/Organization");
const logger = require('../utils/logger');

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
    logger.info("User found or created:", user);

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
        });

        const updated = await User.findByIdAndUpdate(
          user._id,
          { orgId: org._id, orgRole: "owner" },
          { new: true }
        );
        user.orgId = updated.orgId;
        user.orgRole = updated.orgRole;
        logger.info(`Organization created for user ${user._id}:`, org._id);
      } catch (orgErr) {
        logger.error("Organization creation failed:", orgErr.message);
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
    console.error("Login error:", error);
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
    logger.info("Decoded token From Verify Auth:", decoded);

    const user = await User.findOne({
      _id: decoded._id,
      applicationId: applicationId,
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found or inactive" });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    logger.error("Verify error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const healthCheck = (_req, res) => {
  logger.info("Health check endpoint hit");
  return res.status(200).json({ status: "ok", service: "auth-service" });
};

module.exports = { login, logout, verify, refresh, healthCheck };
