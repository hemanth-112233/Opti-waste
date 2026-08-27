import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'OptiWaste FinOps API',
        version: '1.0.0',
        description: 'Node.js Express + Mongoose API replacing legacy FastAPI backend.',
    },
    servers: [
        { url: 'http://localhost:8001/api/v1', description: 'Local Server' }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        '/auth/token': {
            post: {
                summary: 'Login',
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    username: { type: 'string' },
                                    password: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                responses: { '200': { description: 'Success' } }
            }
        },
        '/metrics/dashboard': {
            get: {
                summary: 'Dashboard Metric Summary',
                responses: { '200': { description: 'Success' } }
            }
        },
        '/metrics': {
            get: {
                summary: 'Get All Metrics',
                responses: { '200': { description: 'Success' } }
            },
            post: {
                summary: 'Create Metric',
                responses: { '201': { description: 'Created' } }
            }
        },
        '/metrics/{metric_id}': {
            put: { summary: 'Update Metric', parameters: [{ in: 'path', name: 'metric_id', required: true }], responses: { '200': { description: 'Success' } } },
            delete: { summary: 'Delete Metric', parameters: [{ in: 'path', name: 'metric_id', required: true }], responses: { '200': { description: 'Success' } } }
        },
        '/costs/dashboard': {
            get: {
                summary: 'Dashboard Cost Summary',
                responses: { '200': { description: 'Success' } }
            }
        },
        '/costs/trends': {
            get: {
                summary: 'Cost Trends Analysis',
                responses: { '200': { description: 'Success' } }
            }
        },
        '/costs': {
            get: {
                summary: 'Get All Costs',
                responses: { '200': { description: 'Success' } }
            },
            post: {
                summary: 'Create Cost Record',
                responses: { '201': { description: 'Created' } }
            }
        },
        '/costs/{cost_id}': {
            put: { summary: 'Update Cost', parameters: [{ in: 'path', name: 'cost_id', required: true }], responses: { '200': { description: 'Success' } } },
            delete: { summary: 'Delete Cost', parameters: [{ in: 'path', name: 'cost_id', required: true }], responses: { '200': { description: 'Success' } } }
        },
        '/resources/dashboard/summary': {
            get: {
                summary: 'Dashboard Resource Summary',
                responses: { '200': { description: 'Success' } }
            }
        },
        '/providers': {
            get: {
                summary: 'Get All Providers',
                responses: { '200': { description: 'Success' } }
            },
            post: {
                summary: 'Create Provider',
                responses: { '201': { description: 'Created' } }
            }
        },
        '/providers/{provider_id}': {
            put: { summary: 'Update Provider', parameters: [{ in: 'path', name: 'provider_id', required: true }], responses: { '200': { description: 'Success' } } },
            delete: { summary: 'Delete Provider', parameters: [{ in: 'path', name: 'provider_id', required: true }], responses: { '200': { description: 'Success' } } }
        },
        '/providers/{provider_id}/activate': { put: { summary: 'Activate Provider', parameters: [{ in: 'path', name: 'provider_id', required: true }], responses: { '200': { description: 'Success' } } } },
        '/providers/{provider_id}/deactivate': { put: { summary: 'Deactivate Provider', parameters: [{ in: 'path', name: 'provider_id', required: true }], responses: { '200': { description: 'Success' } } } },
        '/resources': {
            get: {
                summary: 'Get All Resources',
                responses: { '200': { description: 'Success' } }
            },
            post: {
                summary: 'Create Resource',
                responses: { '201': { description: 'Created' } }
            }
        },
        '/resources/{resource_id}': {
            get: { summary: 'Get Resource', parameters: [{ in: 'path', name: 'resource_id', required: true }], responses: { '200': { description: 'Success' } } },
            put: { summary: 'Update Resource', parameters: [{ in: 'path', name: 'resource_id', required: true }], responses: { '200': { description: 'Success' } } },
            delete: { summary: 'Delete Resource', parameters: [{ in: 'path', name: 'resource_id', required: true }], responses: { '200': { description: 'Success' } } }
        }
    }
};

export const setupSwagger = (app: Express) => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
