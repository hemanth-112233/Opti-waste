import { z } from 'zod';

export const cloudProviderCreateSchema = z.object({
    provider_name: z.string().min(1),
    provider_type: z.string().min(1),
    account_name: z.string().min(1),
    account_id: z.string().min(1),
    region: z.string().min(1),
    credentials: z.string().optional(),
    status: z.string().optional().default('active')
});

export const providerQuerySchema = z.object({
    skip: z.preprocess((val) => Number(val) || 0, z.number().min(0).default(0)),
    limit: z.preprocess((val) => Number(val) || 100, z.number().min(1).default(100)),
    search: z.string().optional(),
    status: z.string().optional(),
    sort: z.string().optional()
});

export const cloudProviderUpdateSchema = cloudProviderCreateSchema.partial();

export const resourceQuerySchema = z.object({
    skip: z.preprocess((val) => Number(val) || 0, z.number().min(0).default(0)),
    limit: z.preprocess((val) => Number(val) || 100, z.number().min(1).default(100)),
    search: z.string().optional(),
    provider_id: z.string().optional(),
    status: z.string().optional(),
    sort: z.string().optional()
});

export const cloudResourceCreateSchema = z.object({
    provider_id: z.string().min(1),
    provider_type: z.string().optional(),
    resource_name: z.string().min(1),
    resource_type: z.string().min(1),
    instance_type: z.string().nullable().optional(),
    service_name: z.string().min(1),
    region: z.string().min(1),
    availability_zone: z.string().nullable().optional(),
    cpu: z.number().min(0).optional().default(0),
    memory: z.number().min(0).optional().default(0),
    storage: z.number().min(0).optional().default(0),
    operating_system: z.string().nullable().optional(),
    status: z.string().min(1),
    owner: z.string().nullable().optional(),
    project_name: z.string().nullable().optional(),
    environment: z.string().optional().default('Development'),
    monthly_cost: z.number().min(0).optional().default(0),
    tags: z.record(z.any()).optional().default({})
});

export const cloudResourceUpdateSchema = cloudResourceCreateSchema.partial();

export const costRecordCreateSchema = z.object({
    resource_id: z.string().uuid(),
    provider_id: z.string().uuid(),
    billing_period: z.string().min(1),
    daily_cost: z.number().min(0).optional().default(0),
    weekly_cost: z.number().min(0).optional().default(0),
    monthly_cost: z.number().min(0).optional().default(0),
    projected_monthly_cost: z.number().min(0).optional().default(0),
    currency: z.string().optional().default('USD'),
    billing_status: z.string().optional().default('pending'),
    cost_timestamp: z.string().datetime().optional()
});

export const costRecordUpdateSchema = costRecordCreateSchema.partial();

export const resourceMetricCreateSchema = z.object({
    resource_id: z.string().uuid(),
    cpu_utilization: z.number().min(0).max(100).optional().default(0),
    memory_utilization: z.number().min(0).max(100).optional().default(0),
    storage_utilization: z.number().min(0).max(100).optional().default(0),
    network_in: z.number().min(0).optional().default(0),
    network_out: z.number().min(0).optional().default(0),
    disk_read: z.number().min(0).optional().default(0),
    disk_write: z.number().min(0).optional().default(0),
    uptime_hours: z.number().min(0).optional().default(0),
    instance_state: z.string().optional().default('running'),
    metric_timestamp: z.string().datetime().optional()
});

export const resourceMetricUpdateSchema = resourceMetricCreateSchema.partial();
