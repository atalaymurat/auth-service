const axios = require("axios");

let buffer = [];
let timer = null;

const getConfig = () => ({
  backendUrl: process.env.BACKEND_URL || "http://192.168.1.100:3021",
  apiKey: process.env.INTERNAL_API_KEY,
});

const flush = async () => {
  if (buffer.length === 0) return;
  const toSend = buffer.splice(0);
  const { backendUrl, apiKey } = getConfig();

  try {
    await axios.post(
      `${backendUrl}/api/logs/ingest`,
      { logs: toSend },
      { headers: { "x-internal-api-key": apiKey }, timeout: 5000 }
    );
  } catch {
    buffer = [...toSend.slice(-50), ...buffer.slice(0, 50)];
  }
};

const send = (entry) => {
  const isDev = !["production", "prod"].includes(process.env.NODE_ENV);
  if (isDev) return;

  buffer.push({ ...entry, service: "auth-service", timestamp: new Date() });

  if (buffer.length >= 10) {
    if (timer) { clearTimeout(timer); timer = null; }
    flush();
  } else if (!timer) {
    timer = setTimeout(() => { timer = null; flush(); }, 3000);
  }
};

module.exports = { send, flush };
