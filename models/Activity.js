const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: String,
    token: String,
    amount: Number,
    network: String,
    address: String,
    status: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", ActivitySchema);
