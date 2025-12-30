require("dotenv").config();
const express = require("express");

const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const app = express();

/* ============================
   CONFIG
============================ */
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMINS = [
  "coindcx.ac@gmail.com",
  "admin2@email.com"
];


/* ============================
   CORS
============================ */
const cors = require("cors");

app.use(
  cors({
    origin: true,          // ⭐ KEY FIX (reflects request origin)
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);




app.use(express.json());

/* ============================
   GOOGLE CLIENT
============================ */
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/* ============================
   DATABASE
============================ */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error", err));

/* ============================
   MODELS
============================ */
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      googleId: String,
      name: String,
      email: String,
      usdtBalance: { type: Number, default: 0 },

      bonusUnlocked: { type: Boolean, default: false },
      bonusUsed: { type: Boolean, default: false },

      withdrawUnlockAt: { type: Date }
    },
    { timestamps: true }
  )
);

const Activity = mongoose.model(
  "Activity",
  new mongoose.Schema(
    {
      userId: mongoose.Schema.Types.ObjectId,
      type: String,
      token: String,
      amount: Number,
      network: String,
      status: String
    },
    { timestamps: true }
  )
);

const Deposit = mongoose.model(
  "Deposit",
  new mongoose.Schema(
    {
      userId: mongoose.Schema.Types.ObjectId,
      amount: Number,
      network: String,
      status: { type: String, default: "pending" }
    },
    { timestamps: true }
  )
);

const Withdrawal = mongoose.model(
  "Withdrawal",
  new mongoose.Schema(
    {
      userId: mongoose.Schema.Types.ObjectId,
      amount: Number,
      network: String,
      address: String,
      status: { type: String, default: "pending" }
    },
    { timestamps: true }
  )
);

/* ============================
   AUTH MIDDLEWARE
============================ */


function auth(req, res, next) {
    function auth(req, res, next) {
  // ✅ Allow preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    return next();
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  // rest of your code
}

  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (!ADMINS.includes(req.user.email)) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}


/* ============================
   RATE LIMIT
============================ */
const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
});

/* ============================
   ROUTES
============================ */
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

/* GOOGLE LOGIN */
app.post("/api/auth/google", googleAuthLimiter, async (req, res) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        name: payload.name,
        email: payload.email
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { name: user.name, email: user.email } });
  } catch {
    res.status(401).json({ error: "Google auth failed" });
  }
});

/* DASHBOARD */
app.get("/api/dashboard", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  const activity = await Activity.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    user: { name: user.name, email: user.email },
    balances: { usdt: user.usdtBalance },
    bonus: {
      unlocked: user.bonusUnlocked,
      used: user.bonusUsed
    },
    withdrawUnlockAt: user.withdrawUnlockAt,
    activity
  });
});



/* ADMIN — APPROVE DEPOSIT */
app.post("/api/admin/deposit/:id/approve", auth, adminOnly, async (req, res) => {
  const deposit = await Deposit.findById(req.params.id);
  const user = await User.findById(deposit.userId);

  deposit.status = "approved";
  await deposit.save();

  user.usdtBalance += deposit.amount;
  user.bonusUnlocked = true;
  user.withdrawUnlockAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await user.save();

  res.json({ success: true });
});

/* USER WITHDRAW REQUEST */
app.post("/api/withdraw", auth, async (req, res) => {
  const user = await User.findById(req.user.id);

  if (user.withdrawUnlockAt && new Date() < user.withdrawUnlockAt) {
    return res.status(403).json({ error: "Withdraw locked (2 hours)" });
  }

  await Withdrawal.create({
    userId: user._id,
    amount: req.body.amount,
    network: req.body.network,
    address: req.body.address
  });

  res.json({ success: true });
});
// ============================
// USER CONFIRM DEPOSIT
// ============================
app.post("/api/deposit", auth, async (req, res) => {
  const { amount, network } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  await Deposit.create({
    userId: req.user.id,
    amount,
    network
  });

  res.json({
    success: true,
    message: "Deposit submitted. Awaiting admin approval."
  });
});


// ============================
// ADMIN — VIEW PENDING DEPOSITS
// ============================
app.get("/api/admin/deposits", auth, adminOnly, async (req, res) => {
  try {
    const deposits = await Deposit.find({ status: "pending" })
      .populate("userId", "email");

    res.json(deposits);
  } catch (err) {
    console.error("❌ Admin deposit fetch error", err);
    res.status(500).json({ error: "Failed to fetch deposits" });
  }
});

// ============================
// ADMIN — VIEW WITHDRAWALS
// ============================
app.get("/api/admin/withdrawals", auth, adminOnly, async (req, res) => {
  const withdrawals = await Withdrawal.find()
    .populate("userId", "email")
    .sort({ createdAt: -1 });

  res.json(withdrawals);
});


// ============================
// ADMIN — APPROVE WITHDRAWAL
// ============================
app.post("/api/admin/withdrawals/:id/approve", auth, adminOnly, async (req, res) => {
  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return res.status(404).json({ error: "Not found" });

  if (withdrawal.status !== "pending") {
    return res.status(400).json({ error: "Already processed" });
  }

  withdrawal.status = "approved";
  await withdrawal.save();

  await Activity.create({
    userId: withdrawal.userId,
    type: "Withdraw",
    token: "USDT",
    amount: withdrawal.amount,
    network: withdrawal.network,
    status: "Completed"
  });

  res.json({ success: true });
});



// ============================
// ADMIN — APPROVE DEPOSIT
// ============================
app.post("/api/admin/deposits/:id/approve", auth, adminOnly, async (req, res) => {
  const deposit = await Deposit.findById(req.params.id);
  if (!deposit) return res.status(404).json({ error: "Deposit not found" });

  if (deposit.status !== "pending") {
    return res.status(400).json({ error: "Already processed" });
  }

  deposit.status = "approved";
  await deposit.save();

  const user = await User.findById(deposit.userId);

  // 💰 CREDIT BALANCE (100 + 100 bonus)
  user.usdtBalance += 200;
  user.bonusUnlocked = true;

  // ⏳ LOCK WITHDRAW FOR 2 HOURS
  user.withdrawUnlockAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await user.save();

  await Activity.create({
    userId: user._id,
    type: "Deposit",
    token: "USDT",
    amount: deposit.amount,
    network: deposit.network,
    status: "Completed"
  });

  res.json({ success: true });
});


// ADMIN — REJECT
app.post("/api/admin/deposit/:id/reject", auth, adminOnly, async (req, res) => {
  await Deposit.findByIdAndUpdate(req.params.id, { status: "rejected" });
  res.json({ success: true });
});

/* ============================
   START
============================ */
app.listen(PORT, () =>
  console.log(`🚀 ZOPAY backend running on ${PORT}`)
);
// ============================
// ADMIN — ANALYTICS
// ============================
app.get("/api/admin/analytics", auth, adminOnly, async (req, res) => {
  res.json({
    users: await User.countDocuments(),
    deposits: await Deposit.countDocuments({ status: "approved" }),
    withdrawals: await Withdrawal.countDocuments({ status: "approved" })
  });
});
