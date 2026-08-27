// reset-test-user.ts — Delete stale test users, re-create with known passwords
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './src/models/User';
import { Role } from './src/models/Role';
import { env } from './src/config/env';

const run = async () => {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected:', env.MONGODB_URI);

    // Ensure roles exist
    let userRole = await Role.findOne({ name: 'User' });
    if (!userRole) {
        userRole = await Role.findOneAndUpdate(
            { name: 'User' },
            { name: 'User', permissions: ['read'] },
            { upsert: true, new: true }
        );
    }

    // Delete + re-create yasin127 with KNOWN password
    await User.deleteOne({ email: 'yasin127@gmail.com' });
    const hash1 = await bcrypt.hash('Password123!', 12);
    await new User({ name: 'Yasin Kumar', email: 'yasin127@gmail.com', password_hash: hash1, role: userRole?._id, is_active: true }).save();
    console.log('yasin127@gmail.com reset with password: Password123!');

    // Delete + re-create test user  
    await User.deleteOne({ email: 'testuser@optiwaste.com' });
    const hash2 = await bcrypt.hash('Password456!', 12);
    await new User({ name: 'Test User', email: 'testuser@optiwaste.com', password_hash: hash2, role: userRole?._id, is_active: true }).save();
    console.log('testuser@optiwaste.com reset with password: Password456!');

    const users = await User.find({ email: { $in: ['yasin127@gmail.com', 'testuser@optiwaste.com'] } }, { name: 1, email: 1, is_active: 1 });
    console.log('Users in DB:', JSON.stringify(users, null, 2));

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
