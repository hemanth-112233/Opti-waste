import api from './axiosInstance';

// ── Type Definitions ──────────────────────────────────────────────────────────

export type VerificationStatus =
    | 'pending'
    | 'in_progress'
    | 'verified'
    | 'partially_verified'
    | 'failed'
    | 'not_verifiable';

/** Populated recommendation reference inside a VerificationRecord */
export interface VerificationRecommendation {
    id: string;
    recommendation_title: string;
    recommendation_type: string;
    priority: string;
    predicted_savings: number;
    status: string;
    resource?: {
        id: string;
        resource_name: string;
        resource_type: string;
        monthly_cost: number;
        environment: string;
    } | null;
}

/** A single RecommendationVerification document */
export interface VerificationRecord {
    id: string;
    recommendation: VerificationRecommendation | string;
    verification_status: VerificationStatus;
    predicted_savings: number;
    estimated_risk: string;
    confidence_score: number;
    verified_at: string;
    // Phase 20 fields
    implementation_date: string | null;
    verification_window_days: number;
    baseline_cost: number;
    post_implementation_cost: number;
    actual_savings: number;
    savings_variance: number;
    prediction_error_pct: number;
    pre_sample_count: number;
    post_sample_count: number;
    verification_notes: string;
    created_at: string;
    updated_at: string;
}

/** GET /verifications response */
export interface VerificationListResponse {
    success: boolean;
    data: VerificationRecord[];
    total: number;
    skip: number;
    limit: number;
}

/** GET /verifications/:id response */
export interface VerificationDetailResponse {
    success: boolean;
    data: VerificationRecord;
}

/** GET /verifications/summary response.data shape */
export interface VerificationSummary {
    totalVerifications: number;
    verifiedCount: number;
    partiallyVerifiedCount: number;
    failedCount: number;
    notVerifiableCount: number;
    pendingCount: number;
    avgPredictionErrorPct: number;
    totalConfirmedSavings: number;
    totalPredictedSavings: number;
}

export interface VerificationSummaryResponse {
    success: boolean;
    data: VerificationSummary;
}

/** POST /verifications/run response.data shape */
export interface VerificationRunResult {
    totalProcessed: number;
    verified: number;
    partiallyVerified: number;
    failed: number;
    notVerifiable: number;
    pending: number;
}

export interface VerificationRunResponse {
    success: boolean;
    message: string;
    data: VerificationRunResult;
}

/** Filters for GET /verifications */
export interface VerificationFilters {
    /** verification_status filter — exact backend enum value */
    status?: VerificationStatus | 'all';
    /** recommendation UUID */
    recommendation?: string;
    skip?: number;
    limit?: number;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const VerificationApiService = {
    /**
     * POST /verifications/run
     * Triggers the verification engine for all implemented recommendations.
     * Optionally restricted to specific IDs.
     * Admin / Cloud Engineer only.
     */
    run: async (recommendationIds?: string[]): Promise<VerificationRunResponse> => {
        const body = recommendationIds?.length ? { recommendationIds } : {};
        const response = await api.post<VerificationRunResponse>('/verifications/run', body);
        return response.data;
    },

    /**
     * GET /verifications/summary
     * Aggregated counts: by-status, avg prediction error, confirmed/predicted savings.
     */
    getSummary: async (): Promise<VerificationSummaryResponse> => {
        const response = await api.get<VerificationSummaryResponse>('/verifications/summary');
        return response.data;
    },

    /**
     * GET /verifications
     * Filterable paginated list.
     * Supported filters: status (exact enum), recommendation (UUID), skip, limit.
     */
    getList: async (filters: VerificationFilters = {}): Promise<VerificationListResponse> => {
        const params: Record<string, string | number> = {
            skip: filters.skip ?? 0,
            limit: filters.limit ?? 100,
        };
        if (filters.status && filters.status !== 'all') params.status = filters.status;
        if (filters.recommendation) params.recommendation = filters.recommendation;

        const response = await api.get<VerificationListResponse>('/verifications', { params });
        return response.data;
    },

    /**
     * GET /verifications/:id
     * Full detail with recommendation (and nested resource) populated.
     */
    getOne: async (id: string): Promise<VerificationDetailResponse> => {
        const response = await api.get<VerificationDetailResponse>(`/verifications/${id}`);
        return response.data;
    },
};
