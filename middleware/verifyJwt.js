const { verifyToken } = require("../utils/jwt");

const verifyJwt = (req, res, next) => {
  // Cookie veya Authorization header'dan token al
  const token = req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) return res.status(401).json({ message: "Token gerekli." });

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Geçersiz token." });
  }
};

module.exports = { verifyJwt };
