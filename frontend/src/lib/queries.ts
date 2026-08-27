import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import { RecommendationService } from '../api/recommendations';
import type { RecommendationFilters, RecommendationStatus } from '../api/recommendations';


export const providerKeys = {
    all: ['providers'] as const,
    lists: () => [...providerKeys.all, 'list'] as const,
    list: (filters: string) => [...providerKeys.lists(), { filters }] as const,
    details: () => [...providerKeys.all, 'detail'] as const,
    detail: (id: string) => [...providerKeys.details(), id] as const,
};

const fetchProviders = async (query: any) => {
    const { data } = await api.get('/providers', { params: query });
    return data;
};

export const useProviders = (query: any) => {
    return useQuery<any>({
        queryKey: providerKeys.list(JSON.stringify(query)),
        queryFn: () => fetchProviders(query)
    });
};

export const useCreateProvider = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: any) => {
            const { data } = await api.post('/providers', payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: providerKeys.all }),
    });
};

export const useUpdateProvider = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            const { data } = await api.put(`/providers/${id}`, payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: providerKeys.all }),
    });
};

export const useToggleProviderStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, action }: { id: string; action: 'activate' | 'deactivate' }) => {
            const { data } = await api.put(`/providers/${id}/${action}`);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: providerKeys.all }),
    });
};

export const useDeleteProvider = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.delete(`/providers/${id}`);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: providerKeys.all }),
    });
};

export const resourceKeys = {
    all: ['resources'] as const,
    lists: () => [...resourceKeys.all, 'list'] as const,
    list: (filters: string) => [...resourceKeys.lists(), { filters }] as const,
    summary: () => [...resourceKeys.all, 'summary'] as const,
};

const fetchResources = async (query: any) => {
    const { data } = await api.get('/resources', { params: query });
    return data;
};

export const useResources = (query: any) => {
    return useQuery<any>({
        queryKey: resourceKeys.list(JSON.stringify(query)),
        queryFn: () => fetchResources(query)
    });
};

export const useResourceSummary = () => {
    return useQuery<any>({
        queryKey: resourceKeys.summary(),
        queryFn: async () => {
            const { data } = await api.get('/resources/dashboard/summary');
            return data;
        }
    });
};

export const useCreateResource = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: any) => {
            const { data } = await api.post('/resources', payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all }),
    });
};

export const useUpdateResource = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            const { data } = await api.put(`/resources/${id}`, payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all }),
    });
};

export const useDeleteResource = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.delete(`/resources/${id}`);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: resourceKeys.all }),
    });
};

export const metricKeys = {
    all: ['metrics'] as const,
    lists: () => [...metricKeys.all, 'list'] as const,
    list: (filters: string) => [...metricKeys.lists(), { filters }] as const,
    summary: () => [...metricKeys.all, 'summary'] as const,
    history: (resourceId: string) => [...metricKeys.all, 'history', resourceId] as const,
};

const fetchMetrics = async (query: any) => {
    const { data } = await api.get('/metrics', { params: query });
    return data;
};

export const useMetrics = (query: any) => {
    return useQuery<any>({
        queryKey: metricKeys.list(JSON.stringify(query)),
        queryFn: () => fetchMetrics(query)
    });
};

export const useMetricHistory = (resourceId: string, skip: number = 0, limit: number = 200) => {
    return useQuery<any>({
        queryKey: metricKeys.history(resourceId),
        queryFn: async () => {
            if (!resourceId) return { data: [], total: 0 };
            const { data } = await api.get(`/metrics/history/${resourceId}`, { params: { skip, limit } });
            return data;
        },
        enabled: !!resourceId
    });
};

export const useMetricSummary = () => {
    return useQuery<any>({
        queryKey: metricKeys.summary(),
        queryFn: async () => {
            const { data } = await api.get('/metrics/dashboard');
            return data;
        }
    });
};

export const useCreateMetric = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: any) => {
            const { data } = await api.post('/metrics', payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: metricKeys.all }),
    });
};

export const useUpdateMetric = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            const { data } = await api.put(`/metrics/${id}`, payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: metricKeys.all }),
    });
};

export const useDeleteMetric = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.delete(`/metrics/${id}`);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: metricKeys.all }),
    });
};

export const costKeys = {
    all: ['costs'] as const,
    lists: () => [...costKeys.all, 'list'] as const,
    list: (filters: string) => [...costKeys.lists(), { filters }] as const,
    summary: () => [...costKeys.all, 'summary'] as const,
    trends: () => [...costKeys.all, 'trends'] as const,
};

export const useCostSummary = () => {
    return useQuery<any>({
        queryKey: costKeys.summary(),
        queryFn: async () => {
            const { data } = await api.get('/costs/dashboard');
            return data;
        }
    });
};

export const useCostTrends = (days: number = 30) => {
    return useQuery<any>({
        queryKey: costKeys.trends(),
        queryFn: async () => {
            const { data } = await api.get('/costs/trends', { params: { days } });
            return data;
        }
    });
};

export const useCosts = (query: any) => {
    return useQuery<any>({
        queryKey: costKeys.list(JSON.stringify(query)),
        queryFn: async () => {
            const { data } = await api.get('/costs', { params: query });
            return data;
        }
    });
};

export const useCreateCost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: any) => {
            const { data } = await api.post('/costs', payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: costKeys.all }),
    });
};

export const useUpdateCost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            const { data } = await api.put(`/costs/${id}`, payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: costKeys.all }),
    });
};

export const useDeleteCost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.delete(`/costs/${id}`);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: costKeys.all }),
    });
};

// ── Recommendation Queries & Mutations ─────────────────────────────────────────

export const recommendationKeys = {
    all: ['recommendations'] as const,
    lists: () => [...recommendationKeys.all, 'list'] as const,
    list: (filters: string) => [...recommendationKeys.lists(), { filters }] as const,
    summary: () => [...recommendationKeys.all, 'summary'] as const,
    details: () => [...recommendationKeys.all, 'detail'] as const,
    detail: (id: string) => [...recommendationKeys.details(), id] as const,
};

export const useRecommendationSummary = () => {
    return useQuery<any>({
        queryKey: recommendationKeys.summary(),
        queryFn: () => RecommendationService.getSummary(),
        staleTime: 30_000,
    });
};

export const useRecommendations = (filters: RecommendationFilters = {}) => {
    return useQuery<any>({
        queryKey: recommendationKeys.list(JSON.stringify(filters)),
        queryFn: () => RecommendationService.getList(filters),
        staleTime: 30_000,
    });
};

export const useRecommendation = (id: string | null) => {
    return useQuery<any>({
        queryKey: recommendationKeys.detail(id ?? ''),
        queryFn: () => RecommendationService.getOne(id!),
        enabled: !!id,
        staleTime: 10_000,
    });
};

export const useGenerateRecommendations = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => RecommendationService.generate(),
        onSuccess: () => qc.invalidateQueries({ queryKey: recommendationKeys.all }),
    });
};

export const useUpdateRecommendationStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: RecommendationStatus }) =>
            RecommendationService.updateStatus(id, status),
        onSuccess: () => qc.invalidateQueries({ queryKey: recommendationKeys.all }),
    });
};

// ── Verification Queries & Mutations ────────────────────────────────────────────

import { VerificationApiService } from '../api/verifications';
import type { VerificationFilters } from '../api/verifications';

export const verificationKeys = {
    all: ['verifications'] as const,
    lists: () => [...verificationKeys.all, 'list'] as const,
    list: (filters: string) => [...verificationKeys.lists(), { filters }] as const,
    summary: () => [...verificationKeys.all, 'summary'] as const,
    details: () => [...verificationKeys.all, 'detail'] as const,
    detail: (id: string) => [...verificationKeys.details(), id] as const,
};

export const useVerificationSummary = () => {
    return useQuery<any>({
        queryKey: verificationKeys.summary(),
        queryFn: () => VerificationApiService.getSummary(),
        staleTime: 30_000,
    });
};

export const useVerifications = (filters: VerificationFilters = {}) => {
    return useQuery<any>({
        queryKey: verificationKeys.list(JSON.stringify(filters)),
        queryFn: () => VerificationApiService.getList(filters),
        staleTime: 30_000,
    });
};

export const useVerification = (id: string | null) => {
    return useQuery<any>({
        queryKey: verificationKeys.detail(id ?? ''),
        queryFn: () => VerificationApiService.getOne(id!),
        enabled: !!id,
        staleTime: 10_000,
    });
};

export const useRunVerification = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (recommendationIds?: string[]) => VerificationApiService.run(recommendationIds),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: verificationKeys.all });
            qc.invalidateQueries({ queryKey: recommendationKeys.all });
        },
    });
};
