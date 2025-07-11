// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectToMongo = require('./db');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const User = require('./models/User');
const Group = require('./models/Group');
const PrivateUser = require('./models/PrivateUser');
const PrivateGroup = require('./models/PrivateGroup');

connectToMongo();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --------------------- AUTH ---------------------
app.post('/api/signup', async (req, res) => {
  const { name, mobile, dob } = req.body;
  try {
    let user = await User.findOne({ mobile });
    if (user) return res.status(400).json({ message: 'User already exists' });

    user = new User({ name, mobile, dob });
    await user.save();
    res.json({ message: 'Signup successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { mobile, dob } = req.body;
  try {
    const user = await User.findOne({ mobile, dob });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --------------------- TODAY'S BIRTHDAYS ---------------------
app.get('/api/birthdays/today/:mobile', async (req, res) => {
  try {
    const mobile  = req.params.mobile;
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    // 1. Find current user to get their ID
    const currentUser = await User.findOne({ mobile });
    let publicUsers = [];
    
    if (currentUser) {
      // 2. Get groups where user is a member (using ObjectID)
      const groups = await Group.find({ 
        "members.userId": currentUser._id, 
        type: 'public' 
      });

      // 3. Extract all member IDs from groups
      const memberUserIds = groups.flatMap(group => 
        group.members.map(member => member.userId)
      );

      // 4. Fetch public users in these groups with today's birthday
      publicUsers = await User.aggregate([
        { $match: { _id: { $in: memberUserIds } } },
        { $addFields: { 
          day: { $dayOfMonth: "$dob" }, 
          month: { $month: "$dob" } 
        }},
        { $match: { day, month } },
        { $project: { name: 1, mobile: 1, dob: 1, source: { $literal: "public" } } }
      ]);
    }

    // 5. Fetch private users (unchanged)
    const privateUsers = await PrivateUser.aggregate([
      { $match: { createdBy: currentUser._id }  },
      { $addFields: { 
        day: { $dayOfMonth: "$dob" }, 
        month: { $month: "$dob" } 
      }},
      { $match: { day, month } },
      { $project: { name: 1, mobile: 1, dob: 1, source: { $literal: "private" } } }
    ]);

    res.json({
      count: publicUsers.length + privateUsers.length,
      birthdays: [...publicUsers, ...privateUsers]
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching birthdays', error: err.message });
  }
});
//----------------------fetch all private users created by a specified user -----------------

app.get('/api/private-users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const privateUsers = await PrivateUser.find({ createdBy: new mongoose.Types.ObjectId(userId) });

    res.json({
      success: true,
      count: privateUsers.length,
      users: privateUsers
    });
  } catch (err) {
    console.error('[Fetch Private Users Error]', err.message);
    res.status(500).json({ message: 'Error fetching private users', error: err.message });
  }
});



//-----------------------Get user Obj id public -------------------
app.get('/api/user/:mobile', async (req, res) => {
  try {
    const user = await User.findOne({ mobile: req.params.mobile }, '_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
//-----------------------Get user Obj id private -------------------
app.get('/api/private-user/:mobile', async (req, res) => {
  try {
    const user = await PrivateUser.findOne({ mobile: req.params.mobile }, '_id');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
//fetch the private user details based on the object id
app.get('/api/private/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await PrivateUser.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Private user not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("[Fetch Private User Error]", err.message);
    res.status(500).json({ message: "Error fetching private user", error: err.message });
  }
});


// --------------------- PUBLIC GROUP ---------------------

app.get('/api/public/:groupId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).populate('members.userId', 'name mobile dob');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching group', error: err.message });
  }
});

// --------------------- PRIVATE GROUP ---------------------
app.get('/api/private/:groupId', async (req, res) => {
  try {
    const group = await PrivateGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Private group not found' });

    const users = await Promise.all(group.members.map(async m => await PrivateUser.findById(m.privateUserId)));
    res.json({ group, members: users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching private group', error: err.message });
  }
});
// --------------------- private USER ADD ---------------------

app.post('/api/privateuser', async (req, res) => {
  const { name, mobile, dob, createdBy } = req.body;

  try {
    const existingUser = await PrivateUser.findOne({ mobile, createdBy });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Private user already exists for this creator',
        user: existingUser
      });
    }

    const newUser = new PrivateUser({ name, mobile, dob, createdBy });
    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Private user created successfully',
      user: newUser
    });
  } catch (err) {
    console.error('[PrivateUser Create Error]', err.message);
    res.status(500).json({ success: false, message: 'Error creating private user', error: err.message });
  }
});


// --------------------- FETCH PUBLIC GROUPS FOR A USER ---------------------
app.get('/api/public/groups/:userId', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const groups = await Group.find(
      {
        $or: [
          { 'members.userId': userId },
          { createdBy: userId }
        ]
      },
      '_id' // return only group _id fields
    );

    const groupIds = groups.map(group => group._id);
    res.json({ groupIds });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user group IDs', error: err.message });
  }
});




// --------------------- PRIVATE GROUP CREATION / LIST ---------------------
app.get('/api/private/creategroup/:userId', async (req, res) => {
  try {
    const groups = await PrivateGroup.find({ createdBy: req.params.userId });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching private groups', error: err.message });
  }
});

app.post('/api/private/creategroup', async (req, res) => {
  const { name, createdBy } = req.body;
  try {
    const group = new PrivateGroup({ name, createdBy });
    await group.save();
    res.json({ message: 'Private group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Error creating group', error: err.message });
  }
});

// --------------------- ADD PRIVATE USER TO GROUP ---------------------
app.post('/api/private/add/:groupId/:userId', async (req, res) => {
  try {
    const group = await PrivateGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Private group not found' });

    const alreadyMember = group.members.some(m => m.privateUserId.toString() === req.params.userId);
    if (alreadyMember) return res.status(400).json({ message: 'User already exists in private group' });

    group.members.push({ privateUserId: req.params.userId });
    await group.save();
    res.json({ message: 'User added to private group', group });
  } catch (err) {
    res.status(500).json({ message: 'Error adding user to group', error: err.message });
  }
});

// --------------------- ADD PUBLIC USER TO GROUP ---------------------
app.post('/api/public/creategroup', async (req, res) => {
  const { name, createdBy } = req.body;
  try {
   // const inviteCode = uuidv4();
    const group = new Group({ name, createdBy ,members:[{userId:createdBy}]});
    await group.save();
    res.json({ message: 'Public group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Error creating group', error: err.message });
  }
});

app.post('/api/public/add/:groupId/:userId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Public group not found' });

    const alreadyMember = group.members.some(m => m.userId.toString() === req.params.userId);
    if (alreadyMember) return res.status(400).json({ message: 'User already exists in public group' });

    group.members.push({ userId: req.params.userId });
    await group.save();
    res.json({ message: 'User added to public group', group });
  } catch (err) {
    res.status(500).json({ message: 'Error adding user to group', error: err.message });
  }
});

// --------------------- EDIT PRIVATE USER ---------------------
app.put('/api/private/edit/:userId', async (req, res) => {
  try {
    const updated = await PrivateUser.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    res.json({ message: 'Private user updated', user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating private user', error: err.message });
  }
});

// --------------------- EDIT PUBLIC USER ---------------------
app.post('/api/group/exit', async (req, res) => {
  try {
    const { groupId, userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid groupId or userId" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Remove the user from members array
    group.members = group.members.filter(
      member => member.userId.toString() !== userId
    );

    // If no members left, delete the group
    if (group.members.length === 0) {
      await group.deleteOne();
      return res.json({ success: true, message: "You were the last member. Group deleted." });
    }

    // If creator is trying to leave but members still exist
    if (group.createdBy.toString() === userId && group.members.length > 0) {
      return res.status(403).json({
        message: "Creator cannot leave the group while other members are present"
      });
    }

    // Save changes and respond
    await group.save();
    res.json({ success: true, message: "User removed from group", group });

  } catch (err) {
    console.error("[Exit Group Error]", err.message);
    res.status(500).json({ message: "Error exiting group", error: err.message });
  }
});


// --------------------- DELETE PRIVATE USER ---------------------
app.delete('/api/private/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid private user ID" });
    }

    // Check if user exists
    const privateUser = await PrivateUser.findById(userId);
    if (!privateUser) {
      return res.status(404).json({ message: "Private user not found" });
    }

    // Remove from all private groups
    await PrivateGroup.updateMany(
      { "members.privateUserId": userId },
      { $pull: { members: { privateUserId: userId } } }
    );

    // Delete the private user
    await PrivateUser.findByIdAndDelete(userId);

    res.json({ success: true, message: "Private user deleted and removed from all groups" });
  } catch (err) {
    console.error("[Delete Private User Error]", err.message);
    res.status(500).json({ message: "Error deleting private user", error: err.message });
  }
});


// --------------------- START SERVER ---------------------
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
