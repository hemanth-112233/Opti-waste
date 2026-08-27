import { Router } from 'express';
import { ResourceMetricService } from '../services/ResourceMetricService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { resourceMetricCreateSchema, resourceMetricUpdateSchema } from '../validators/schemas';

const router = Router();

router.get('/dashboard', authenticateToken, async (req, res, next) => {
    try {
        const summary = await ResourceMetricService.getDashboardSummary();
        res.json(summary);
    } catch (err) { next(err); }
});

router.get('/latest/:resource_id', authenticateToken, async (req, res, next) => {
    try {
        const metric = await ResourceMetricService.getLatestMetric(req.params.resource_id);
        res.json(metric);
    } catch (err) { next(err); }
});

router.get('/history/:resource_id', authenticateToken, async (req, res, next) => {
    try {
        const { skip = 0, limit = 200 } = req.query;
        const metrics = await ResourceMetricService.getMetrics(Number(skip), Number(limit), req.params.resource_id);
        res.json(metrics);
    } catch (err) { next(err); }
});

router.get('/resource/:resource_id', authenticateToken, async (req, res, next) => {
    try {
        const metrics = await ResourceMetricService.getMetrics(0, 1000, req.params.resource_id);
        res.json(metrics);
    } catch (err) { next(err); }
});

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { skip = 0, limit = 100, resource_id } = req.query;
        const metrics = await ResourceMetricService.getMetrics(Number(skip), Number(limit), resource_id as string);
        res.json(metrics);
    } catch (err) { next(err); }
});

router.get('/:metric_id', authenticateToken, async (req, res, next) => {
    try {
        const metric = await ResourceMetricService.getMetric(req.params.metric_id);
        if (!metric) return res.status(404).json({ detail: 'Metric not found' });
        res.json(metric);
    } catch (err) { next(err); }
});

router.post('/', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), validate(resourceMetricCreateSchema), async (req: any, res, next) => {
    try {
        const metric = await ResourceMetricService.createMetric(req.body, req.user?.sub);
        res.status(201).json(metric);
    } catch (err: any) {
        if (err.message.includes('not found') || err.message.includes('already exists') || err.message.includes('between')) {
            return res.status(422).json({ detail: err.message });
        }
        next(err);
    }
});

router.put('/:metric_id', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), validate(resourceMetricUpdateSchema), async (req: any, res, next) => {
    try {
        const metric = await ResourceMetricService.updateMetric(req.params.metric_id, req.body, req.user?.sub);
        if (!metric) return res.status(404).json({ detail: 'Metric not found' });
        res.json(metric);
    } catch (err: any) {
        if (err.message.includes('between')) return res.status(422).json({ detail: err.message });
        next(err);
    }
});

router.delete('/:metric_id', authenticateToken, requireRoles(['Administrator']), async (req: any, res, next) => {
    try {
        const success = await ResourceMetricService.deleteMetric(req.params.metric_id, req.user?.sub);
        if (!success) return res.status(404).json({ detail: 'Metric not found' });
        res.json({ success: true, message: 'Metric deleted.' });
    } catch (err) { next(err); }
});

export default router;
