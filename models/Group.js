const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['public'], default: 'public' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inviteCode: { type: String, required: true },
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['admin', 'member'], default: 'member' },
      joinedAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('Group', groupSchema);
