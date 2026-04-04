const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db"); // Import the connectDB function
const logger = require('./utils/logger');

dotenv.config();
// --- Connect to Database ---
connectDB(); // Call the function to establish the connection

const authRoutes = require("./routes/auth");
const orgRoutes = require("./routes/organization");

const app = express();
const PORT = process.env.PORT || 3022;
const allowedOrigins = [
  "http://192.168.1.100:3020",
  "http://localhost",
  "http://localhost:3020",
  process.env.FRONTEND_URL,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/org", orgRoutes);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
