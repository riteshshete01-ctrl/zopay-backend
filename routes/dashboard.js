const express = require("express");
const auth = require("../middleware/auth");
const Activity = require("../models/Activity");
const Campaign = require("../models/Campaign");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const activity = await Activity.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(10);

  const campaign = await Campaign.findOne();

  res.json({
    user: req.user,
    balances: { usdt: req.user.usdtBalance },
    bonus: {
      unlocked: req.user.bonusUnlocked,
      used: req.user.bonusUsed,
    },
    activity,
    campaign: { count: campaign?.count || 0 },
  });
});

module.exports = router;
