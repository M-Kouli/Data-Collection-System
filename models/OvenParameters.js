const mongoose = require('mongoose');

// Define the schema for control limits
const ControlLimitsSchema = new mongoose.Schema({
  upper: { type: Number, required: true },
  lower: { type: Number, required: true }
});

// Define the schema for oven parameters
const OvenParametersSchema = new mongoose.Schema({
  ovenName: { type: String, required: true, unique: true },
  numberOfBoards: { type: Number, required: true },
  parameters: {
    temperature: ControlLimitsSchema,
    p1: ControlLimitsSchema,
    p2: ControlLimitsSchema,
    t1: ControlLimitsSchema,
    t2: ControlLimitsSchema,
    vx: ControlLimitsSchema,
    vz: ControlLimitsSchema,
    ct: ControlLimitsSchema,
    vt: ControlLimitsSchema
  },
  boardNumber: { type: Number, required: true } // Add boardNumber
});

const OvenParameters = mongoose.model('OvenParameters', OvenParametersSchema);

module.exports = OvenParameters;
