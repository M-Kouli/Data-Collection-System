const mongoose = require('mongoose');

const warningSettingsSchema = new mongoose.Schema({
  ovenName: { type: String, required: true, unique: true },
  warningsEnabled: { type: Boolean, default: true },  // Field to enable or disable warnings
  failureTracker: {
    count: { type: Number, default: 0 },
    failures: { type: [String], default: [] },  // Store unique failure types
  },
});

module.exports = mongoose.model('WarningSettings', warningSettingsSchema);
