import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { IRole } from './Role';

export interface IUser extends Document<any> {
    _id: Buffer | string;
    name: string;
    email: string;
    password_hash: string;
    role: IRole['_id'];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

const userSchema = new Schema<IUser>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, required: true },
    role: { type: 'UUID', ref: 'Role' },
    is_active: { type: Boolean, default: true, index: true }
}, { collection: 'users' });

userSchema.plugin(BaseModelPlugin);

export const User = mongoose.model<IUser>('User', userSchema);
