import { Router } from 'express';
import { CloudProviderService } from '../services/CloudProviderService';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { cloudProviderCreateSchema, cloudProviderUpdateSchema } from '../validators/schemas';

const router = Router();

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const { skip = 0, limit = 100, search, status, sort } = req.query;
        const result = await CloudProviderService.getProviders(
            Number(skip),
            Number(limit),
            search as string,
            status as string,
            sort as string
        );
        res.json(result);
    } catch (err) { next(err); }
});

router.get('/:provider_id', authenticateToken, async (req, res, next) => {
    try {
        const provider = await CloudProviderService.getProvider(req.params.provider_id);
        if (!provider) return res.status(404).json({ detail: 'Provider not found' });
        res.json(provider);
    } catch (err) { next(err); }
});

router.post('/', authenticateToken, requireRoles(['Administrator']), validate(cloudProviderCreateSchema), async (req: any, res, next) => {
    try {
        const provider = await CloudProviderService.createProvider(req.body, req.user?.sub);
        res.status(201).json(provider);
    } catch (err: any) {
        if (err.message === 'Duplicate account ID') return res.status(422).json({ detail: err.message });
        next(err);
    }
});

router.put('/:provider_id', authenticateToken, requireRoles(['Administrator']), validate(cloudProviderUpdateSchema), async (req: any, res, next) => {
    try {
        const provider = await CloudProviderService.updateProvider(req.params.provider_id, req.body, req.user?.sub);
        if (!provider) return res.status(404).json({ detail: 'Provider not found' });
        res.json(provider);
    } catch (err: any) {
        if (err.message === 'Duplicate account ID') return res.status(422).json({ detail: err.message });
        next(err);
    }
});

router.put('/:provider_id/activate', authenticateToken, requireRoles(['Administrator']), async (req: any, res, next) => {
    try {
        const provider = await CloudProviderService.setProviderStatus(req.params.provider_id, 'active', req.user?.sub);
        if (!provider) return res.status(404).json({ detail: 'Provider not found' });
        res.json(provider);
    } catch (err) { next(err); }
});

router.put('/:provider_id/deactivate', authenticateToken, requireRoles(['Administrator']), async (req: any, res, next) => {
    try {
        const provider = await CloudProviderService.setProviderStatus(req.params.provider_id, 'inactive', req.user?.sub);
        if (!provider) return res.status(404).json({ detail: 'Provider not found' });
        res.json(provider);
    } catch (err) { next(err); }
});

router.delete('/:provider_id', authenticateToken, requireRoles(['Administrator']), async (req: any, res, next) => {
    try {
        const success = await CloudProviderService.deleteProvider(req.params.provider_id, req.user?.sub);
        if (!success) return res.status(404).json({ detail: 'Provider not found' });
        res.json({ success: true, message: 'Provider deleted.' });
    } catch (err) { next(err); }
});

export default router;
