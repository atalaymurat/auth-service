const express = require("express");
const router = express.Router();
const { createOrg, getMyOrg, inviteMember, updateMemberRole } = require("../controllers/organization");
const { verifyJwt } = require("../middleware/verifyJwt");

router.post("/create", verifyJwt, createOrg);
router.get("/me", verifyJwt, getMyOrg);
router.post("/invite", verifyJwt, inviteMember);
router.patch("/member/:userId/role", verifyJwt, updateMemberRole);

module.exports = router;
