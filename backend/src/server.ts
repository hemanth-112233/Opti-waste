import { app } from './app';
import { connectDB } from './config/database';
import { env } from './config/env';

const startServer = async () => {
    try {
        await connectDB();
        app.listen(Number(env.PORT), '0.0.0.0', () => {
            console.log(`Server is running on port ${env.PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
