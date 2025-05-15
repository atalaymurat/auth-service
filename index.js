const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db"); // Import the connectDB function

dotenv.config();
// --- Connect to Database ---
connectDB(); // Call the function to establish the connection

const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = [
  "http://localhost:3000",
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
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
