const mongoose = require('mongoose');

const privateUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String },
  dob: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // u1
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrivateUser', privateUserSchema);
