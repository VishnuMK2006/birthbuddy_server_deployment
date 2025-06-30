const mongoose = require('mongoose');

const privateGroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [
    {
      privateUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrivateUser' }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrivateGroup', privateGroupSchema);
