import { Router } from 'express';
import { CloudResourceService } from '../services/CloudResourceService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { cloudResourceCreateSchema, cloudResourceUpdateSchema } from '../validators/schemas';

const router = Router();

router.get('/dashboard/summary', authenticateToken, async (req, res, next) => {
    try {
        const summary = await CloudResourceService.getDashboardSummary();
        res.json(summary);
    } catch (err) { next(err); }
});

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { skip = 0, limit = 100, search, provider_id, status, sort } = req.query;
        const result = await CloudResourceService.getResources(
            Number(skip), Number(limit), search as string, provider_id as string, status as string, sort as string
        );
        res.json(result);
    } catch (err) { next(err); }
});

router.get('/:resource_id', authenticateToken, async (req, res, next) => {
    try {
        const resource = await CloudResourceService.getResource(req.params.resource_id);
        if (!resource) return res.status(404).json({ detail: 'Resource not found' });
        res.json(resource);
    } catch (err) { next(err); }
});

router.post('/', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), validate(cloudResourceCreateSchema), async (req: any, res, next) => {
    try {
        const resource = await CloudResourceService.createResource(req.body, req.user?.sub);
        res.status(201).json(resource);
    } catch (err: any) {
        if (err.message.includes('Invalid provider') || err.message.includes('already exists')) {
            return res.status(422).json({ detail: err.message });
        }
        next(err);
    }
});

router.put('/:resource_id', authenticateToken, requireRoles(['Administrator', 'Cloud Engineer']), validate(cloudResourceUpdateSchema), async (req: any, res, next) => {
    try {
        const resource = await CloudResourceService.updateResource(req.params.resource_id, req.body, req.user?.sub);
        if (!resource) return res.status(404).json({ detail: 'Resource not found' });
        res.json(resource);
    } catch (err: any) {
        if (err.message.includes('Invalid provider')) return res.status(422).json({ detail: err.message });
        next(err);
    }
});

router.delete('/:resource_id', authenticateToken, requireRoles(['Administrator']), async (req: any, res, next) => {
    try {
        const success = await CloudResourceService.deleteResource(req.params.resource_id, req.user?.sub);
        if (!success) return res.status(404).json({ detail: 'Resource not found' });
        res.json({ success: true, message: 'Resource deleted.' });
    } catch (err) { next(err); }
});

export default router;
