const { createLogger, format, transports } = require("winston");
const Transport = require("winston-transport");
const { send } = require("./logTransport");

class RemoteTransport extends Transport {
  log(info, callback) {
    setImmediate(() => this.emit("logged", info));
    const {
      level,
      message,
      service,
      env,
      [Symbol.for("level")]: rawLevel,
      [Symbol.for("message")]: _m,
      [Symbol.for("splat")]: _s,
      ...meta
    } = info;
    send({
      level: rawLevel || level,
      message,
      meta: Object.keys(meta).length ? meta : undefined,
    });
    callback();
  }
}

const isDev = !["production", "prod"].includes(process.env.NODE_ENV);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  defaultMeta: { service: "auth-service" },
  format: isDev
    ? format.combine(
        format.colorize(),
        format.timestamp({ format: "HH:mm:ss" }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const { service, ...rest } = meta;
          const extras = Object.keys(rest).length ? JSON.stringify(rest) : "";
          return `${timestamp} ${level}: ${message} ${extras}`;
        })
      )
    : format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console(),
    new RemoteTransport(),
  ],
});

module.exports = logger;
