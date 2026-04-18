require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const internalAuth = require("./middleware/internalAuth");
connectDB();

const authRoutes = require("./routes/auth");
const orgRoutes = require("./routes/organization");

const app = express();
const PORT = process.env.PORT || 3022;

// CORS: sadece backend'e izin ver
const allowedOrigins = [
  process.env.BACKEND_URL,
  "http://localhost:3021",
  "http://192.168.1.100:3021",
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
  }),
);
app.use(cookieParser());
app.use(express.json());

// Health endpoint — internal auth'tan muaf (Docker healthcheck için)
app.get("/health", (_req, res) =>
  res.status(200).json({ status: "ok", service: "auth-service" }),
);

// Tüm route'lara internal API key kontrolü
app.use(internalAuth);

// Login rate limit: 1 IP'den 10 dakikada max 10 istek
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Çok fazla giriş denemesi. 10 dakika sonra tekrar deneyin.",
  },
});
app.use("/api/auth/login", loginLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/org", orgRoutes);

app.listen(PORT, () => {
  logger.info(`Auth service running on port ${PORT}`);
});
