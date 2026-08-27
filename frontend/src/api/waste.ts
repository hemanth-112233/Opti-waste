import api from './axiosInstance';

// ── Type Definitions ─────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type WasteCategory =
    | 'idle'
    | 'underutilized'
    | 'overprovisioned'
    | 'unattached_storage'
    | 'storage_waste'
    | 'cost_anomaly';

export interface WasteCategoryCounts {
    idle: number;
    underutilized: number;
    overprovisioned: number;
    unattached_storage: number;
    storage_waste: number;
    cost_anomaly: number;
}

export interface AnalysisSummary {
    totalResourcesAnalyzed: number;
    totalFindings: number;
    highRiskFindings: number;
    estimatedWasteCost: number;
    categoryCounts: WasteCategoryCounts;
}

export interface AnalyzeResponse {
    success: boolean;
    message: string;
    data: AnalysisSummary;
}

export interface WasteSummary {
    totalFindings: number;
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
    criticalRisk: number;
    estimatedWasteCost: number;
    idleResources: number;
    underutilizedResources: number;
    overprovisionedResources: number;
    unattachedStorage: number;
    storageWaste: number;
    costAnomalies: number;
}

export interface WasteSummaryResponse {
    success: boolean;
    data: WasteSummary;
}

export interface WasteFindingResource {
    _id: string;
    resource_name: string;
    resource_type: string;
    provider_type: string;
    environment: string;
    monthly_cost: number;
}

export interface WasteFinding {
    _id: string;
    resource: WasteFindingResource | string;
    risk_score: number;
    risk_level: RiskLevel;
    assessment_reason: string;
    confidence_score: number;
    assessment_timestamp: string;
    estimated_waste_cost: number | null;
    waste_categories: WasteCategory[];
}

export interface WasteFindingsResponse {
    success: boolean;
    data: WasteFinding[];
    total: number;
    skip: number;
    limit: number;
}

export interface WasteFindingResponse {
    success: boolean;
    data: WasteFinding;
}

export interface FindingsFilter {
    risk_level?: RiskLevel | 'ALL';
    resource?: string;
    category?: WasteCategory;
    skip?: number;
    limit?: number;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const WasteService = {
    /** POST /waste/analyze — trigger the detection engine */
    analyze: async (): Promise<AnalyzeResponse> => {
        const response = await api.post<AnalyzeResponse>('/waste/analyze');
        return response.data;
    },

    /** GET /waste/summary — aggregated risk and category counts */
    getSummary: async (): Promise<WasteSummaryResponse> => {
        const response = await api.get<WasteSummaryResponse>('/waste/summary');
        return response.data;
    },

    /** GET /waste/findings — list persisted assessments with optional filters */
    getFindings: async (filters: FindingsFilter = {}): Promise<WasteFindingsResponse> => {
        const params: Record<string, string | number> = {
            skip: filters.skip ?? 0,
            limit: filters.limit ?? 100,
        };
        if (filters.risk_level && filters.risk_level !== 'ALL') {
            params.risk_level = filters.risk_level;
        }
        if (filters.resource) params.resource = filters.resource;
        if (filters.category) params.category = filters.category;

        const response = await api.get<WasteFindingsResponse>('/waste/findings', { params });
        return response.data;
    },

    /** GET /waste/findings/:id — single finding detail */
    getFinding: async (id: string): Promise<WasteFindingResponse> => {
        const response = await api.get<WasteFindingResponse>(`/waste/findings/${id}`);
        return response.data;
    },
};
