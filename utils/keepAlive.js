const axios = require("axios");

const SELF_URL = process.env.AUTH_SERVICE_URL || "https://auth.postiva.uk";
const INTERVAL = 14 * 60 * 1000; // 14 dakika

const ping = async () => {
  try {
    await axios.get(`${SELF_URL}/api/auth/health`, { timeout: 10000 });
  } catch (_) {}
};

setTimeout(ping, 60000);
setInterval(ping, INTERVAL);

module.exports = { ping };
