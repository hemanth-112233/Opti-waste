import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from './models/User';
import { Role } from './models/Role';
import { env } from './config/env';

const seedAdmin = async () => {
    try {
        await mongoose.connect(env.MONGODB_URI);
        console.log('Connected to MongoDB');

        let adminRole = await Role.findOne({ name: 'Administrator' });
        if (!adminRole) {
            adminRole = new Role({ name: 'Administrator', permissions: ['*'] });
            await adminRole.save();
        }

        const email = 'admin@optiwaste.com';
        const password = 'Admin@123';

        const existing = await User.findOne({ email });
        if (!existing) {
            const password_hash = await bcrypt.hash(password, 10);
            const admin = new User({
                name: 'System Admin',
                email,
                password_hash,
                role: adminRole._id,
                is_active: true
            });
            await admin.save();
            console.log('Admin user created successfully');
        } else {
            existing.password_hash = await bcrypt.hash(password, 10);
            existing.role = adminRole._id;
            await existing.save();
            console.log('Admin user reset successfully');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err);
        process.exit(1);
    }
};

seedAdmin();
