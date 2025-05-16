// utils/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.colorize(),                    // Renkli loglar
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(
      ({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`
    )
  ),
  transports: [
    new transports.Console(),
    // new transports.File({ filename: 'logs/error.log', level: 'error' }) // Opsiyonel
  ],
});

module.exports = logger;