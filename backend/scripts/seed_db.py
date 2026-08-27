import asyncio
import logging
from uuid import uuid4
from datetime import datetime, timezone
import random

from app.db.database import init_db
from app.models.role import Role
from app.models.user import User
from app.models.cloud_provider import CloudProvider
from app.models.cloud_resource import CloudResource
from app.models.cost_record import CostRecord
from app.models.waste_risk_assessment import WasteRiskAssessment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed():
    await init_db()
    
    logger.info("Clearing existing basic records (Roles/Users/Providers)...")
    await Role.find_all().delete()
    await User.find_all().delete()
    await CloudProvider.find_all().delete()
    await CloudResource.find_all().delete()
    await CostRecord.find_all().delete()
    
    # 1. Create Roles
    logger.info("Creating Roles...")
    admin_role = Role(name="admin", description="Administrator role with all permissions", permissions=["all"])
    await admin_role.insert()
    user_role = Role(name="user", description="Standard user role", permissions=["read_limited"])
    await user_role.insert()
    
    # 2. Create Users
    logger.info("Creating Users...")
    admin_user = User(
        name="Admin OptiWaste",
        email="admin@optiwaste.example.com",
        password_hash="$2b$12$KIXl0Hw35T1V1G8Z7JbZ1e5z...", # mock hash
        role=admin_role,
        is_active=True
    )
    await admin_user.insert()

    # 3. Create Cloud Providers
    logger.info("Creating Cloud Providers...")
    aws_provider = CloudProvider(
        name="AWS",
        account_id="123456789012",
        region="us-east-1",
        status="active"
    )
    await aws_provider.insert()

    azure_provider = CloudProvider(
        name="Azure",
        account_id="azure-sub-x-y-z",
        region="eastus",
        status="active"
    )
    await azure_provider.insert()

    # 4. Create Cloud Resources
    logger.info("Creating Cloud Resources...")
    ec2_resource = CloudResource(
        provider=aws_provider,
        resource_name="web-production-ec2",
        resource_type="Compute",
        instance_type="t3.large",
        region="us-east-1",
        service_name="Amazon EC2",
        status="running",
        owner="engineering team"
    )
    await ec2_resource.insert()
    
    # 5. Create Cost Records
    logger.info("Creating Cost Records...")
    cost = CostRecord(
        resource=ec2_resource,
        billing_period="2026-08",
        daily_cost=2.45,
        monthly_cost=73.5,
        projected_cost=75.0,
        currency="USD"
    )
    await cost.insert()

    # 6. Dummy Risk Assessments
    logger.info("Creating Risk Assessments...")
    assmt = WasteRiskAssessment(
        resource=ec2_resource,
        risk_score=72.5,
        risk_level="High",
        findings=["Idle 75% of the time", "Over-provisioned memory"],
        assessment_date=datetime.now(timezone.utc)
    )
    await assmt.insert()

    logger.info("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
