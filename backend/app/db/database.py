from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

async def init_db():
    """
    Initialize the database connection and Beanie ODM.
    """
    logger.info("Initializing MongoDB connection...")
    
    # Create Motor client
    client = AsyncIOMotorClient(settings.MONGO_DATABASE_URI)
    
    # Get the database instance
    database = client[settings.MONGO_DB]
    
    from app.models import (
        Role, User, CloudProvider, CloudResource, ResourceMetric,
        CostRecord, WasteRiskAssessment, OptimizationRecommendation,
        RecommendationVerification, RecommendationHistory,
        ClosedLoopFeedback, WasteAssessmentHistory, SavingsAnalytics, AuditLog
    )

    # Initialize Beanie with all document models
    await init_beanie(
        database=database,
        document_models=[
            Role,
            User,
            CloudProvider,
            CloudResource,
            ResourceMetric,
            CostRecord,
            WasteRiskAssessment,
            OptimizationRecommendation,
            RecommendationVerification,
            RecommendationHistory,
            ClosedLoopFeedback,
            WasteAssessmentHistory,
            SavingsAnalytics,
            AuditLog
        ],
    )
    logger.info("MongoDB and Beanie ODM initialized successfully.")

def get_db():
    """
    Dependency to get raw Motor database client if needed.
    (Beanie usually manages documents directly without this, but useful for raw operations)
    """
    client = AsyncIOMotorClient(settings.MONGO_DATABASE_URI)
    return client[settings.MONGO_DB]
