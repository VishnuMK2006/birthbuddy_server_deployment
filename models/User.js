const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  dob: { type: Date, required: true },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }] // public groups only
});

module.exports = mongoose.model('User', userSchema);
