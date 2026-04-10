const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const db = mongoose.connection;
    db.on("error", (err) => logger.error({ message: "DB connection error", error: err.message }));
    db.once("open", () => logger.info({ message: "DB connected", host: db.host }));

    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    logger.error({ message: "DB connection failed", error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
