const express = require("express");
const auth = require("../middleware/auth");
const Activity = require("../models/Activity");
const Campaign = require("../models/Campaign");

const router = express.Router();

router.post("/deposit", auth, async (req, res) => {
  const { amount, network } = req.body;

  req.user.usdtBalance += amount;
  if (!req.user.bonusUnlocked && amount >= 100) {
    req.user.bonusUnlocked = true;
    await Campaign.findOneAndUpdate({}, { $inc: { count: 1 } }, { upsert: true });
  }

  await req.user.save();
  await Activity.create({
    userId: req.user._id,
    type: "Deposit",
    token: "USDT",
    amount,
    network,
    status: "Completed",
  });

  res.json({ ok: true });
});

router.post("/withdraw", auth, async (req, res) => {
  const { amount, network, toAddress } = req.body;

  if (req.user.usdtBalance < amount)
    return res.status(400).json({ error: "Insufficient balance" });

  req.user.usdtBalance -= amount;
  await req.user.save();

  await Activity.create({
    userId: req.user._id,
    type: "Withdraw",
    token: "USDT",
    amount,
    network,
    address: toAddress,
    status: "Pending",
  });

  res.json({ ok: true });
});

module.exports = router;
