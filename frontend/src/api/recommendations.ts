import api from './axiosInstance';

// ── Type Definitions ──────────────────────────────────────────────────────────

export type RecommendationStatus =
    | 'pending'
    | 'accepted'
    | 'dismissed'
    | 'implemented';

export type RecommendationPriority =
    | 'CRITICAL'
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW';

export type RecommendationType =
    | 'idle'
    | 'underutilized'
    | 'overprovisioned'
    | 'unattached_storage'
    | 'storage_waste'
    | 'cost_anomaly';

export interface RecommendationResource {
    id: string;
    resource_name: string;
    resource_type: string;
    provider_type: string;
    environment: string;
    monthly_cost: number;
    instance_type: string | null;
}

export interface Recommendation {
    id: string;
    resource: RecommendationResource | string;
    waste_assessment: string | null;
    recommendation_type: RecommendationType;
    recommendation_title: string;
    recommendation_description: string;
    recommended_action: string;
    recommendation_reason: string;
    predicted_savings: number;
    savings_basis: string;
    estimated_impact: string;
    priority: RecommendationPriority;
    confidence_score: number;
    status: RecommendationStatus;
    generated_at: string;
    created_at: string;
    updated_at: string;
}

export interface RecommendationSummary {
    totalRecommendations: number;
    pendingCount: number;
    acceptedCount: number;
    dismissedCount: number;
    implementedCount: number;
    estimatedTotalSavings: number;
    priorityCounts: {
        CRITICAL: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    typeCounts: Record<string, number>;
}

export interface RecommendationSummaryResponse {
    success: boolean;
    data: RecommendationSummary;
}

export interface RecommendationListResponse {
    success: boolean;
    data: Recommendation[];
    total: number;
    skip: number;
    limit: number;
}

export interface RecommendationDetailResponse {
    success: boolean;
    data: Recommendation;
}

export interface GenerationResult {
    totalAssessmentsProcessed: number;
    totalRecommendationsGenerated: number;
    estimatedTotalSavings: number;
    priorityCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
}

export interface GenerationResponse {
    success: boolean;
    message: string;
    data: GenerationResult;
}

export interface StatusUpdateResponse {
    success: boolean;
    data: Recommendation;
}

export interface RecommendationFilters {
    status?: RecommendationStatus | 'all';
    priority?: RecommendationPriority | 'all';
    recommendation_type?: RecommendationType | 'all';
    resource?: string;
    skip?: number;
    limit?: number;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const RecommendationService = {
    /**
     * POST /recommendations/generate
     * Trigger the recommendation engine across all waste assessments.
     * Admin / Cloud Engineer only.
     */
    generate: async (): Promise<GenerationResponse> => {
        const response = await api.post<GenerationResponse>('/recommendations/generate');
        return response.data;
    },

    /**
     * GET /recommendations/summary
     * Aggregated counts: total, by-status, by-priority, estimated savings.
     */
    getSummary: async (): Promise<RecommendationSummaryResponse> => {
        const response = await api.get<RecommendationSummaryResponse>('/recommendations/summary');
        return response.data;
    },

    /**
     * GET /recommendations
     * Filterable paginated list.
     * Supported filters: status, priority, recommendation_type, resource, skip, limit.
     */
    getList: async (filters: RecommendationFilters = {}): Promise<RecommendationListResponse> => {
        const params: Record<string, string | number> = {
            skip: filters.skip ?? 0,
            limit: filters.limit ?? 100,
        };
        if (filters.status && filters.status !== 'all') params.status = filters.status;
        if (filters.priority && filters.priority !== 'all') params.priority = filters.priority;
        if (filters.recommendation_type && filters.recommendation_type !== 'all') params.recommendation_type = filters.recommendation_type;
        if (filters.resource) params.resource = filters.resource;

        const response = await api.get<RecommendationListResponse>('/recommendations', { params });
        return response.data;
    },

    /**
     * GET /recommendations/:id
     * Full detail with resource and waste_assessment populated.
     */
    getOne: async (id: string): Promise<RecommendationDetailResponse> => {
        const response = await api.get<RecommendationDetailResponse>(`/recommendations/${id}`);
        return response.data;
    },

    /**
     * PATCH /recommendations/:id/status
     * Allowed transitions: pending → accepted/dismissed, accepted → implemented/dismissed.
     */
    updateStatus: async (id: string, status: RecommendationStatus): Promise<StatusUpdateResponse> => {
        const response = await api.patch<StatusUpdateResponse>(`/recommendations/${id}/status`, { status });
        return response.data;
    },
};
