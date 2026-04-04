// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    profilePicture: String,
    emailVerified: { type: Boolean, default: false },
    authProvider: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["user", "admin", "editor", "premium", "superadmin"],
      default: ["user"],
    },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    orgRole: { type: String, enum: ["owner", "admin", "member"], default: null },
    isActive: {
      type: Boolean,
      default: true,
    },
    preferences: {
      theme: { type: String, default: "light" },
      receiveNewsletter: { type: Boolean, default: false },
    },
    applicationId: { type: String, required: true }, // Kullanici hangi uygulamadan geliyor
    lastLoginAt: {
      // Can be updated using 'auth_time' or 'iat' from token
      type: Date,
    },
  },
  {
    // Schema Options
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);
userSchema.index({ email: 1, applicationId: 1 }, { unique: true });
// Create indexes manually after schema definition

// Add the findOrCreate static method
userSchema.statics.findOrCreate = async function (userData) {
  try {
    let user = await this.findOne({
      $or: [{ firebaseUid: userData.firebaseUid }, { email: userData.email }],
      applicationId: userData.applicationId,
    });

    if (!user) {
      user = await this.create({
        firebaseUid: userData.firebaseUid,
        name: userData.name,
        email: userData.email,
        profilePicture: userData.profilePicture,
        emailVerified: userData.emailVerified || false,
        authProvider: userData.authProvider || "password",
        applicationId: userData.applicationId, // 🔐 burada mutlaka olmalı
      });
    }

    return user;
  } catch (error) {
    console.error("User.findOrCreate error:", error);
    throw error;
  }
};

const User = mongoose.model("User", userSchema);
module.exports = User;
