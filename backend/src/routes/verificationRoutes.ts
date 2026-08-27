import { Router } from 'express';
import { VerificationService } from '../services/VerificationService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';

const router = Router();

/**
 * POST /api/v1/verifications/run
 *
 * Trigger the verification engine across all eligible (status=implemented)
 * recommendations. Updates RecommendationVerification, ClosedLoopFeedback,
 * and SavingsAnalytics records.
 *
 * Optional body: { recommendationIds: string[] } — process specific records only.
 *
 * Restricted to Administrator and Cloud Engineer.
 */
router.post(
    '/run',
    authenticateToken,
    requireRoles(['Administrator', 'Cloud Engineer']),
    async (req, res, next) => {
        try {
            const ids: string[] | undefined = req.body?.recommendationIds;
            const summary = await VerificationService.runVerification(
                ids?.length ? { recommendationIds: ids } : undefined
            );
            res.json({
                success: true,
                message: 'Verification run completed.',
                data: summary,
            });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/v1/verifications/summary
 *
 * Aggregated summary: counts by status, avg prediction error,
 * total confirmed actual savings, total predicted savings.
 * All authenticated users.
 */
router.get('/summary', authenticateToken, async (req, res, next) => {
    try {
        const summary = await VerificationService.getSummary();
        res.json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/verifications
 *
 * Filterable list of RecommendationVerification records.
 *
 * Query params:
 *   status         — verified | partially_verified | failed | not_verifiable | pending
 *   recommendation — recommendation UUID
 *   skip           — number (default 0)
 *   limit          — number (default 100)
 */
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { status, recommendation, skip, limit } = req.query;
        const result = await VerificationService.getVerifications({
            status: status as string | undefined,
            recommendation: recommendation as string | undefined,
            skip: skip ? Number(skip) : 0,
            limit: limit ? Number(limit) : 100,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/verifications/:id
 *
 * Return a single verification record by UUID, with recommendation
 * and resource populated for full audit trail context.
 *
 * Malformed UUIDs → 404 (never 500).
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        let verification;
        try {
            verification = await VerificationService.getVerification(req.params.id);
        } catch (castErr: any) {
            if (castErr.name === 'CastError') {
                return res.status(404).json({ success: false, detail: 'Verification not found.' });
            }
            throw castErr;
        }
        if (!verification) {
            return res.status(404).json({ success: false, detail: 'Verification not found.' });
        }
        res.json({ success: true, data: verification });
    } catch (err) {
        next(err);
    }
});

export default router;
