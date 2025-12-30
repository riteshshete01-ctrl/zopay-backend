router.post("/approve-deposit/:id", adminAuth, async (req, res) => {
  const deposit = await Deposit.findById(req.params.id);
  if (!deposit) return res.status(404).json({ error: "Not found" });

  const user = await User.findById(deposit.userId);

  if (!user.bonusGranted && deposit.amount >= 100) {
    user.balance += 200;
    user.bonusGranted = true;
    user.firstDepositAt = new Date();
  }

  deposit.status = "approved";

  await deposit.save();
  await user.save();

  res.json({ message: "Deposit approved" });
});
