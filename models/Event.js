const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true }, // Add eventId
  title: { type: String, required: true },
  notes: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  ovenId: { type: String, required: true }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
