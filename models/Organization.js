const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
    },
  },
  { _id: false }
);

const termSchema = new mongoose.Schema(
  {
    key:        { type: String, required: true },
    label:      { type: String, required: true },
    fieldType:  { type: String, enum: ['text', 'select', 'multiselect'], default: 'text' },
    options:    {
      type: [String],
      validate: { validator: v => v.length <= 10, message: 'options dizisi en fazla 10 eleman içerebilir.' },
    },
    value:      { type: mongoose.Schema.Types.Mixed },
    isEditable: { type: Boolean, default: true },
    isVisible:  { type: Boolean, default: true },
    visibleIn:  { type: [String], enum: ['offer', 'proforma', 'contract'] },
  },
  { _id: false }
);

const bankAccountSchema = new mongoose.Schema(
  {
    bankName:      { type: String, required: true },
    currency:      { type: String, enum: ["TRY", "USD", "EUR"], required: true },
    iban:          { type: String, required: true },
    swiftCode:     String,
    accountHolder: String,
    isActive:      { type: Boolean, default: true },
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
    phone: String,
    email: String,
    address: String,
    website: String,
    taxNo: String,
    offerDefaults: [termSchema],
    bankAccounts:  [bankAccountSchema],
  },
  { timestamps: true }
);

organizationSchema.index({ slug: 1, applicationId: 1 }, { unique: true });

const Organization = mongoose.model("Organization", organizationSchema);
module.exports = Organization;
