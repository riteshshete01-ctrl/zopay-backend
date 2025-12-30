router.post("/deposit", authMiddleware, async (req, res) => {
  const { amount, network } = req.body;

  const deposit = await Deposit.create({
    userId: req.user.id,
    amount,
    network
  });

  res.json({ message: "Deposit request created", deposit });
});
