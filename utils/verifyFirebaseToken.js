const admin = require("./firebaseAdmin");

const verifyFirebaseToken = async (idToken) => {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken;
};

module.exports = verifyFirebaseToken;