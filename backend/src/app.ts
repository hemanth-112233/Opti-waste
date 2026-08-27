import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import apiRoutes from './routes';
import { setupSwagger } from './config/swagger';

export const app = express();

// Security
app.use(helmet());

// CORS — explicit allow-list including the configured production origin
const allowedOrigins = [
    ...env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',    // Vite auto-increments: 5173 → 5174 → 5175
    'http://localhost:8001',    // allow Swagger UI / same-server fetch
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:8001',
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (Postman, curl) and listed origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check (no auth required)
app.get('/', (_req, res) => {
    res.json({
        success: true,
        message: 'OptiWaste API — Node.js/Express',
        version: '1.0.0',
    });
});

app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

setupSwagger(app);

app.use('/api/v1', apiRoutes);

// Global error handler (must be last)
app.use(errorHandler);
