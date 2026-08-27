import { Router } from 'express';
import authRoutes from './authRoutes';
import providerRoutes from './providerRoutes';
import resourceRoutes from './resourceRoutes';
import costRoutes from './costRoutes';
import metricRoutes from './metricRoutes';
import wasteRoutes from './wasteRoutes';
import recommendationRoutes from './recommendationRoutes';
import verificationRoutes from './verificationRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/providers', providerRoutes);
router.use('/resources', resourceRoutes);
router.use('/costs', costRoutes);
router.use('/metrics', metricRoutes);
router.use('/waste', wasteRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/verifications', verificationRoutes);

export default router;


