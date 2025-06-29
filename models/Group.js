const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inviteCode: String,
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['admin', 'member'], default: 'member' },
      joinedAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('Group', groupSchema);
