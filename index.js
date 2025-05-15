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
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors({
  origin:  "*", // geçici olarak "*" olabilir, prod'da kısıtla
  credentials: true
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});