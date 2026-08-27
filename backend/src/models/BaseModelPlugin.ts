import { Schema } from 'mongoose';

export const BaseModelPlugin = (schema: Schema) => {
    // Add timestamps matching Beanie
    schema.set('timestamps', { createdAt: 'created_at', updatedAt: 'updated_at' });

    // Transform JSON output to match Pydantic
    schema.set('toJSON', {
        virtuals: true,
        transform: (doc: any, ret: any) => {
            if (doc._id) {
                ret.id = doc._id.toString();
            }
            delete ret._id;
            delete ret.__v;
        }
    });
};
