require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const usersCol = db.collection("users");
    const orgsCol = db.collection("organizations");

    console.log("🔗 Connected to auth-service DB");

    // --- USERS ---
    const users = await usersCol.find({}).toArray();
    let userFixed = 0;

    for (const user of users) {
      const rawRoles = Array.isArray(user.roles) ? user.roles : [];
      const cleanRoles = rawRoles.filter(r => r === "user" || r === "superadmin");
      if (cleanRoles.length === 0) cleanRoles.push("user");

      const setOps = { roles: cleanRoles };
      if (user.orgId && !user.defaultOrgId) {
        setOps.defaultOrgId = user.orgId;
      }

      await usersCol.updateOne(
        { _id: user._id },
        {
          $set: setOps,
          $unset: { orgId: "", orgRole: "" },
        }
      );
      userFixed++;
    }
    console.log(`✅ ${userFixed} user migrated`);

    // --- ORGANIZATIONS ---
    const orgs = await orgsCol.find({}).toArray();
    let orgFixed = 0;

    for (const org of orgs) {
      const members = Array.isArray(org.members) ? org.members : [];

      members.forEach(m => {
        if (m.role === "admin") m.role = "member";
      });

      const hasOwner = members.some(m => m.role === "owner");
      if (!hasOwner && org.createdBy) {
        const creator = members.find(
          m => m.userId?.toString() === org.createdBy.toString()
        );
        if (creator) {
          creator.role = "owner";
        } else {
          members.push({ userId: org.createdBy, role: "owner" });
        }
      }

      await orgsCol.updateOne({ _id: org._id }, { $set: { members } });
      orgFixed++;
    }
    console.log(`✅ ${orgFixed} organization migrated`);

    // --- Verification ---
    const stillHasOrgId = await usersCol.countDocuments({ orgId: { $exists: true } });
    const stillHasOrgRole = await usersCol.countDocuments({ orgRole: { $exists: true } });
    const hasDefaultOrgId = await usersCol.countDocuments({ defaultOrgId: { $exists: true } });
    const adminInMembers = await orgsCol.countDocuments({ "members.role": "admin" });

    console.log("\n📊 Verification:");
    console.log(`  users with orgId:         ${stillHasOrgId} (should be 0)`);
    console.log(`  users with orgRole:       ${stillHasOrgRole} (should be 0)`);
    console.log(`  users with defaultOrgId:  ${hasDefaultOrgId}`);
    console.log(`  orgs with admin role:     ${adminInMembers} (should be 0)`);

    if (stillHasOrgId || stillHasOrgRole || adminInMembers) {
      console.error("\n❌ Migration verification failed");
      process.exit(1);
    }

    console.log("\n🎉 Migration complete and verified");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
})();
