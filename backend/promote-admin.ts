/**
 * promote-admin.ts
 * OptiWaste — One-time admin promotion script
 *
 * Promotes an existing 'User'-role account to 'Administrator' directly
 * in MongoDB, then disconnects.  The user must log out and log back in
 * so the backend issues a fresh JWT that contains role:'Administrator'.
 *
 * Usage:
 *   npx ts-node promote-admin.ts <email>
 *
 * Example:
 *   npx ts-node promote-admin.ts haswanth@example.com
 */

import mongoose from 'mongoose';
import { User } from './src/models/User';
import { Role } from './src/models/Role';
import { AuthService } from './src/services/AuthService';
import { env } from './src/config/env';

const run = async () => {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) {
        console.error('Usage: npx ts-node promote-admin.ts <email>');
        process.exit(1);
    }

    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB:', env.MONGODB_URI.replace(/\/\/[^@]+@/, '//<credentials>@'));

    // Ensure canonical roles exist
    await AuthService.seedDefaultRoles();

    const adminRole = await Role.findOne({ name: 'Administrator' });
    if (!adminRole) {
        console.error('Administrator role not found even after seeding. Check the database.');
        await mongoose.disconnect();
        process.exit(1);
    }

    const updated = await User.findOneAndUpdate(
        { email },
        { role: adminRole._id },
        { new: true }
    ).populate('role').lean() as any;

    if (!updated) {
        console.error(`No user found with email: ${email}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const roleName = (updated.role as any)?.name ?? 'Administrator';

    console.log('\n✅ Success!');
    console.log(`   User:  ${updated.name} <${updated.email}>`);
    console.log(`   Role:  ${roleName}`);
    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('   The user must LOG OUT and LOG BACK IN.');
    console.log('   The frontend holds an old JWT with role:User.');
    console.log('   A fresh login issues a new JWT with role:Administrator.');
    console.log('   Only then will POST /recommendations/generate work.\n');

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(e => {
    console.error('Error:', e.message ?? e);
    process.exit(1);
});
