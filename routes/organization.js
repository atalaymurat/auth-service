const express = require("express");
const router = express.Router();
const { createOrg, getMyOrg, inviteMember, updateMemberRole, updateOrg, updateOfferDefaults, updateBankAccounts } = require("../controllers/organization");
const { verifyJwt } = require("../middleware/verifyJwt");

router.post("/create", verifyJwt, createOrg);
router.get("/me", verifyJwt, getMyOrg);
router.post("/invite", verifyJwt, inviteMember);
router.patch("/member/:userId/role", verifyJwt, updateMemberRole);
router.patch("/update", verifyJwt, updateOrg);
router.patch("/:id/offer-defaults", verifyJwt, updateOfferDefaults);
router.patch("/:id/bank-accounts", verifyJwt, updateBankAccounts);

module.exports = router;
