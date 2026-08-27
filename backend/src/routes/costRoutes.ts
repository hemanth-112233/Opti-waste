import { Router } from 'express';
import { CostService } from '../services/CostService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { costRecordCreateSchema, costRecordUpdateSchema } from '../validators/schemas';

const router = Router();

router.get('/dashboard', authenticateToken, async (req, res, next) => {
    try {
        const summary = await CostService.getDashboardSummary();
        res.json(summary);
    } catch (err) { next(err); }
});

router.get('/trends', authenticateToken, async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const trends = await CostService.getCostTrends(Number(days));
        res.json(trends);
    } catch (err) { next(err); }
});

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { skip = 0, limit = 100, resource_id, provider_id } = req.query;
        const costs = await CostService.getCostRecords(Number(skip), Number(limit), resource_id as string, provider_id as string);
        res.json(costs);
    } catch (err) { next(err); }
});

router.get('/:cost_id', authenticateToken, async (req, res, next) => {
    try {
        const cost = await CostService.getCostRecord(req.params.cost_id);
        if (!cost) return res.status(404).json({ detail: 'Cost record not found' });
        res.json(cost);
    } catch (err) { next(err); }
});

router.post('/', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), validate(costRecordCreateSchema), async (req: any, res, next) => {
    try {
        const cost = await CostService.createCostRecord(req.body, req.user?.sub);
        res.status(201).json(cost);
    } catch (err: any) {
        if (err.message.includes('not found') || err.message.includes('already exists') || err.message.includes('negative')) {
            return res.status(422).json({ detail: err.message });
        }
        next(err);
    }
});

router.put('/:cost_id', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), validate(costRecordUpdateSchema), async (req: any, res, next) => {
    try {
        const cost = await CostService.updateCostRecord(req.params.cost_id, req.body, req.user?.sub);
        if (!cost) return res.status(404).json({ detail: 'Cost record not found' });
        res.json(cost);
    } catch (err: any) {
        if (err.message.includes('negative')) return res.status(422).json({ detail: err.message });
        next(err);
    }
});

router.delete('/:cost_id', authenticateToken, requireRoles(['Administrator']), async (req: any, res, next) => {
    try {
        const success = await CostService.deleteCostRecord(req.params.cost_id, req.user?.sub);
        if (!success) return res.status(404).json({ detail: 'Cost record not found' });
        res.json({ success: true, message: 'Cost record deleted.' });
    } catch (err) { next(err); }
});

export default router;
