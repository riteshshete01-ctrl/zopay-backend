const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },
});

module.exports = mongoose.model("Campaign", CampaignSchema);
