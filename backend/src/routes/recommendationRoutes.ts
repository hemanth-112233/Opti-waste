import { Router } from 'express';
import { OptimizationRecommendationService } from '../services/OptimizationRecommendationService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';

const router = Router();

/**
 * POST /api/v1/recommendations/generate
 *
 * Trigger recommendation generation from existing WasteRiskAssessment findings.
 * Restricted to Administrator and Cloud Engineer.
 *
 * Optional body: { wasteIds: string[] } — process specific assessments only.
 */
router.post(
    '/generate',
    authenticateToken,
    requireRoles(['Administrator', 'Cloud Engineer']),
    async (req, res, next) => {
        try {
            const wasteIds: string[] | undefined = req.body?.wasteIds;
            const summary = await OptimizationRecommendationService.runGeneration(
                wasteIds?.length ? { wasteIds } : undefined
            );
            res.json({ success: true, message: 'Recommendation generation completed.', data: summary });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/v1/recommendations/summary
 *
 * Aggregated summary: counts by priority, status, type; total predicted savings.
 * All authenticated users.
 */
router.get('/summary', authenticateToken, async (req, res, next) => {
    try {
        const summary = await OptimizationRecommendationService.getSummary();
        res.json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/recommendations
 *
 * Filterable list of OptimizationRecommendation records.
 *
 * Query params:
 *   priority            — LOW | MEDIUM | HIGH | CRITICAL
 *   status              — pending | accepted | dismissed | implemented
 *   recommendation_type — idle | underutilized | overprovisioned |
 *                         unattached_storage | storage_waste | cost_anomaly
 *   resource            — resource UUID
 *   skip                — number (default 0)
 *   limit               — number (default 100)
 */
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { priority, status, recommendation_type, resource, skip, limit } = req.query;
        const result = await OptimizationRecommendationService.getRecommendations({
            priority: priority as string | undefined,
            status: status as string | undefined,
            recommendation_type: recommendation_type as string | undefined,
            resource: resource as string | undefined,
            skip: skip ? Number(skip) : 0,
            limit: limit ? Number(limit) : 100,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/recommendations/:id
 *
 * Return a single recommendation by its UUID, with resource and assessment populated.
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        let rec;
        try {
            rec = await OptimizationRecommendationService.getRecommendation(req.params.id);
        } catch (castErr: any) {
            if (castErr.name === 'CastError') {
                return res.status(404).json({ success: false, detail: 'Recommendation not found.' });
            }
            throw castErr;
        }
        if (!rec) return res.status(404).json({ success: false, detail: 'Recommendation not found.' });
        res.json({ success: true, data: rec });
    } catch (err) {
        next(err);
    }
});

/**
 * PATCH /api/v1/recommendations/:id/status
 *
 * Update recommendation status (accept, dismiss, mark implemented).
 * Restricted to Administrator and Cloud Engineer.
 *
 * Body: { status: "accepted" | "dismissed" | "implemented" | "pending" }
 */
router.patch(
    '/:id/status',
    authenticateToken,
    requireRoles(['Administrator', 'Cloud Engineer']),
    async (req, res, next) => {
        try {
            const { status } = req.body ?? {};
            if (!status) {
                return res.status(400).json({ success: false, detail: 'status field is required.' });
            }
            let updated;
            try {
                updated = await OptimizationRecommendationService.updateStatus(req.params.id, status);
            } catch (castErr: any) {
                if (castErr.name === 'CastError') {
                    return res.status(404).json({ success: false, detail: 'Recommendation not found.' });
                }
                if (castErr.message?.startsWith('Invalid status')) {
                    return res.status(400).json({ success: false, detail: castErr.message });
                }
                throw castErr;
            }
            if (!updated) return res.status(404).json({ success: false, detail: 'Recommendation not found.' });
            res.json({ success: true, message: `Status updated to "${status}".`, data: updated });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
