import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';

export interface IAuditLog extends Document<any> {
    _id: Buffer | string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    user_id: string | null;
    details: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    action: { type: String, required: true, index: true },
    resource_type: { type: String, required: true, index: true },
    resource_id: { type: String, default: null },
    user_id: { type: String, default: null, index: true },
    details: { type: Schema.Types.Mixed, default: {} }
}, { collection: 'audit_logs' });

auditLogSchema.plugin(BaseModelPlugin);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
