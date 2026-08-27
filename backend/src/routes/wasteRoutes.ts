import { Router } from 'express';
import { WasteDetectionService } from '../services/WasteDetectionService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';

const router = Router();

/**
 * POST /api/v1/waste/analyze
 *
 * Trigger waste detection analysis across all active cloud resources.
 * Reads cloud_resources, resource_metrics, cost_records.
 * Writes to waste_risk_assessments and waste_assessment_history.
 * Restricted to Administrator and Cloud Engineer roles.
 */
router.post('/analyze', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), async (req, res, next) => {
    try {
        const summary = await WasteDetectionService.runAnalysis();
        res.json({
            success: true,
            message: 'Waste analysis completed.',
            data: summary,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/waste/summary
 *
 * Return aggregated summary of all persisted waste assessments.
 */
router.get('/summary', authenticateToken, async (req, res, next) => {
    try {
        const summary = await WasteDetectionService.getSummary();
        res.json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/waste/findings
 *
 * Return persisted WasteRiskAssessment records.
 *
 * Query params:
 *   risk_level — LOW | MEDIUM | HIGH | CRITICAL
 *   resource   — resource UUID
 *   category   — idle | underutilized | overprovisioned | unattached_storage | storage_waste | cost_anomaly
 *   skip       — number (default 0)
 *   limit      — number (default 100)
 */
router.get('/findings', authenticateToken, async (req, res, next) => {
    try {
        const { risk_level, resource, category, skip, limit } = req.query;
        const result = await WasteDetectionService.getFindings({
            risk_level: risk_level as string | undefined,
            resource: resource as string | undefined,
            category: category as string | undefined,
            skip: skip ? Number(skip) : 0,
            limit: limit ? Number(limit) : 100,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/waste/findings/:id
 *
 * Return a single waste assessment by its ID.
 */
router.get('/findings/:id', authenticateToken, async (req, res, next) => {
    try {
        let finding;
        try {
            finding = await WasteDetectionService.getFinding(req.params.id);
        } catch (castErr: any) {
            // Mongoose CastError: invalid UUID format → treat as not found
            if (castErr.name === 'CastError') {
                return res.status(404).json({ success: false, detail: 'Waste assessment not found.' });
            }
            throw castErr;
        }
        if (!finding) return res.status(404).json({ success: false, detail: 'Waste assessment not found.' });
        res.json({ success: true, data: finding });
    } catch (err) {
        next(err);
    }
});


export default router;
