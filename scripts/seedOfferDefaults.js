require("dotenv").config();
const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const offerDefaultsSeed = require("../utils/offerDefaultsSeed");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await Organization.updateMany(
    {},
    { $set: { offerDefaults: offerDefaultsSeed } }
  );

  console.log(`Updated ${result.modifiedCount} organization(s).`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
