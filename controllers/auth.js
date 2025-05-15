const verifyFirebaseToken = require("../utils/verifyFirebaseToken");
const { createToken, verifyToken } = require("../utils/jwt");
const User = require("../models/User");

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
    console.log("User found or created:", user);
    const token = createToken(user);

    return res.status(200).json({
      success: true,
      accessToken: token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(401).json({ error: "Login failed" });
  }
};

const logout = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};

const verify = async (req, res) => {
  try {
    const { token, applicationId } = req.body;
    if (!token || !applicationId) {
      return res
        .status(400)
        .json({ error: "Token and applicationId required" });
    }

    const decoded = verifyToken(token);
    console.log("Decoded token From Verify Auth:", decoded);

    const user = await User.findOne({
      _id: decoded._id,
      applicationId: applicationId,
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "User not found or inactive" });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("Verify error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const healthCheck = (_req, res) => {
  return res.status(200).json({ status: "ok", service: "auth-service" });
};

module.exports = { login, logout, verify, healthCheck };
