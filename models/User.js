const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    usdtBalance: { type: Number, default: 0 },
    bonusUnlocked: { type: Boolean, default: false },
    bonusUsed: { type: Boolean, default: false },
    
    // ============================
    // NEW FEATURES (DO NOT REMOVE)
    // ============================

    // User says: "I HAVE DEPOSITED"
    hasDeposited: { type: Boolean, default: false },

    // Amount user claims (example: 100 USDT)
    depositAmount: { type: Number, default: 0 },

    // Admin verifies deposit on-chain
    isAdminApproved: { type: Boolean, default: false },

    // Withdrawal unlock time (now + 2 hours)
    withdrawUnlockAt: { type: Date, default: null }
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
