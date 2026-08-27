import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';

export interface IRole extends Document<any> {
    _id: Buffer | string;
    name: string;
    description: string | null;
    permissions: string[];
    created_at: Date;
    updated_at: Date;
}

const roleSchema = new Schema<IRole>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    permissions: { type: [String], default: [] }
}, { collection: 'roles' });

roleSchema.plugin(BaseModelPlugin);

export const Role = mongoose.model<IRole>('Role', roleSchema);
