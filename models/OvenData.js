const mongoose = require('mongoose');

const ovenDataSchema = new mongoose.Schema({
  ovenId: { type: String, required: true },
  timestamp: { type: String, required: true },
  temperature: { type: Number, required: true },
  temperatureUpperControlLimit: { 
    type: Number, 
    required: function() { return this.hasOvenControlLimits === true; } 
  },
  temperatureLowerControlLimit: { 
    type: Number, 
    required: function() { return this.hasOvenControlLimits === true; } 
  },
  dataType: { type: String, enum: ['Oven', 'Board'], required: true },
  hasOvenControlLimits: { type: Boolean, required: function() { return this.dataType === 'Oven'; } },
  hasBoardControlLimits: { type: Boolean, required: function() { return this.dataType === 'Board'; } },
  boardId: { type: String, required: function() { return this.dataType === 'Board'; } },
  p1: { type: Number, default: null },
  p1UpperControlLimit: { type: Number, default: null },
  p1LowerControlLimit: { type: Number, default: null },
  p2: { type: Number, default: null },
  p2UpperControlLimit: { type: Number, default: null },
  p2LowerControlLimit: { type: Number, default: null },
  t1: { type: Number, default: null },
  t1UpperControlLimit: { type: Number, default: null },
  t1LowerControlLimit: { type: Number, default: null },
  t2: { type: Number, default: null },
  t2UpperControlLimit: { type: Number, default: null },
  t2LowerControlLimit: { type: Number, default: null },
  vx: { type: Number, default: null },
  vxUpperControlLimit: { type: Number, default: null },
  vxLowerControlLimit: { type: Number, default: null },
  vz: { type: Number, default: null },
  vzUpperControlLimit: { type: Number, default: null },
  vzLowerControlLimit: { type: Number, default: null },
  ct: { type: Number, default: null },
  ctUpperControlLimit: { type: Number, default: null },
  ctLowerControlLimit: { type: Number, default: null },
  vt: { type: Number, default: null },
  vtUpperControlLimit: { type: Number, default: null },
  vtLowerControlLimit: { type: Number, default: null },
});

module.exports = mongoose.model('OvenData', ovenDataSchema);
