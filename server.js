require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");

const app = express();
const rateLimit = require("express-rate-limit");

// ============================
// CONFIG
// ============================
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// ✅ CHANGE THIS (VERY IMPORTANT)
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://lighthearted-sunshine-6fedb3.netlify.app",
   "https://zopay-wallet.netlify.app"
];

// ============================
// CORS (FIXED FOR NETLIFY)
// ============================
// ============================
// CORS (FIXED FOR NETLIFY)
// ============================

// ============================
// CORS — FINAL PRODUCTION SAFE
// ============================

// ============================
// CORS — SIMPLE & STABLE (RENDER + NETLIFY)
// ============================
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://lighthearted-sunshine-6fedb3.netlify.app",
    "https://zopay-wallet.netlify.app"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("/*", cors());
app.use(express.json());

// ============================
// GOOGLE CLIENT
// ============================
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ============================
// DATABASE
// ============================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error", err));

// ============================
// MODELS
// ============================
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      googleId: String,
      name: String,
      email: String,
      usdtBalance: { type: Number, default: 0 },
      bonusUnlocked: { type: Boolean, default: false },
      bonusUsed: { type: Boolean, default: false }
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

// ============================
// AUTH MIDDLEWARE
// ============================
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Unauthorized" });

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
// ============================
// RATE LIMIT — GOOGLE AUTH
// ============================
const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again later."
  }
});

// ============================
// ROUTES
// ============================
app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

// ============================
// GOOGLE LOGIN
// ============================
app.post("/api/auth/google", googleAuthLimiter, async (req, res) => {

  try {
    const { credential } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
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

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error("❌ Google auth error", err);
    res.status(401).json({ error: "Google auth failed" });
  }
});

// ============================
// DASHBOARD
// ============================
app.get("/api/dashboard", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  const activity = await Activity.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    user: { name: user.name, email: user.email },
    balance: user.usdtBalance,
    bonus: {
      unlocked: user.bonusUnlocked,
      used: user.bonusUsed
    },
    activity,
    campaign: {
      count: await User.countDocuments({ bonusUnlocked: true })
    }
  });
});

// ============================
// WITHDRAW
// ============================
app.post("/api/withdraw", auth, async (req, res) => {
  const { amount, network, address } = req.body;

if (!amount || amount <= 0) {
  return res.status(400).json({ error: "Invalid amount" });
}

if (!["ERC20", "TRC20", "BEP20"].includes(network)) {
  return res.status(400).json({ error: "Invalid network" });
}

if (!address || address.length < 10) {
  return res.status(400).json({ error: "Invalid address" });
}

});
// ============================
// GLOBAL ERROR HANDLER (PROD SAFE)
// ============================
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.message);

  res.status(500).json({
    error: "Something went wrong. Please try again later."
  });
});

// ============================
// START SERVER
// ============================
app.listen(PORT, () => {
  console.log(`🚀 ZOPAY backend running on port ${PORT}`);
});
