const verifyFirebaseToken = require("../utils/verifyFirebaseToken");
const { createToken, verifyToken } = require("../utils/jwt");
const User = require("../models/User");
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

    const user = await User.findOrCreate(userData);
    logger.info("User found or created:", user);
    const token = createToken(user);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      domain: isProduction ? ".postiva.uk" : undefined,
      maxAge: 24 * 60 * 60 * 1000, // 1 gün
    });

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
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? ".postiva.uk" : undefined,
  });
  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
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

module.exports = { login, logout, verify, healthCheck };
