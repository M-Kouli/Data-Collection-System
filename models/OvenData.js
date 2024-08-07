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
  p1: { type: Number, required: function() { return this.dataType === 'Board'; } },
  p1UpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  p1LowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  p2: { type: Number, required: function() { return this.dataType === 'Board'; } },
  p2UpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  p2LowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  t1: { type: Number, required: function() { return this.dataType === 'Board'; } },
  t1UpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  t1LowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  t2: { type: Number, required: function() { return this.dataType === 'Board'; } },
  t2UpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  t2LowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  vx: { type: Number, required: function() { return this.dataType === 'Board'; } },
  vxUpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  vxLowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  vz: { type: Number, required: function() { return this.dataType === 'Board'; } },
  vzUpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  vzLowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  ct: { type: Number, required: function() { return this.dataType === 'Board'; } },
  ctUpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  ctLowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  vt: { type: Number, required: function() { return this.dataType === 'Board'; } },
  vtUpperControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
  vtLowerControlLimit: { 
    type: Number, 
    required: function() { return this.dataType === 'Board' && this.hasBoardControlLimits === true; } 
  },
});

module.exports = mongoose.model('OvenData', ovenDataSchema);
