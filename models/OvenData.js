const mongoose = require('mongoose');

const ovenDataSchema = new mongoose.Schema({
  ovenId: { type: String, required: true }, // Changed to String
  timestamp: { type: Date, default: Date.now },
  temperature: Number,
  dataType: { type: String, enum: ['Oven', 'Board'], required: true },
  boardId: { type: String, required: function() { return this.dataType === 'Board'; } },
  p1: { type: Number, required: function() { return this.dataType === 'Board'; } },
  p2: { type: Number, required: function() { return this.dataType === 'Board'; } },
  t1: { type: Number, required: function() { return this.dataType === 'Board'; } },
  t2: { type: Number, required: function() { return this.dataType === 'Board'; } },
  vx: { type: Number, required: function() { return this.dataType === 'Board'; } },
  vz: { type: Number, required: function() { return this.dataType === 'Board'; } },
  ct: { type: Number, required: function() { return this.dataType === 'Board'; } },
  vt: { type: Number, required: function() { return this.dataType === 'Board'; } }
});

module.exports = mongoose.model('OvenData', ovenDataSchema);
