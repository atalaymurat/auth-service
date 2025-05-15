const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Set up listeners *before* connecting. Mongoose handles this.
    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'MongoDB connection error: '));
    db.once('open', function () {
      console.log(`
    --------------------------------
    Auth-Service MongoDB connection status [OK]
    Host: ${db.host}
    --------------------------------
          `);
    });

    // Attempt connection (returns a promise)
    // Use mongoose.connect which returns a promise
    await mongoose.connect(process.env.MONGODB_URI);
    // The 'open' event listener above will handle the success message.

  } catch (error) {
    console.error('Initial MongoDB connection failed:', error.message);
    // Exit process with failure code if initial connection fails during startup
    process.exit(1);
  }
};

module.exports = connectDB;