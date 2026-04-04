const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logo: String,
    applicationId: { type: String, required: true },
    members: [memberSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    logo: String,
    phone: String,
    email: String,
    address: String,
    website: String,
    taxNo: String,
  },
  { timestamps: true }
);

organizationSchema.index({ slug: 1, applicationId: 1 }, { unique: true });

const Organization = mongoose.model("Organization", organizationSchema);
module.exports = Organization;
