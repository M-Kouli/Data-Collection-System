// models/OvenStatus.js
const mongoose = require('mongoose');

const ovenStatusSchema = new mongoose.Schema({
  ovenName: { type: String, required: true, unique: true },
  status: { type: String, required: true },
  timestamp: { type: String, required: true },
});

module.exports = mongoose.model('OvenStatus', ovenStatusSchema);
