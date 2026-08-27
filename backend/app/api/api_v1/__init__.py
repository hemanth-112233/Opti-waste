from fastapi import APIRouter
from app.api.api_v1.api import api_router

# In the future add other routers from modules like here
# api_router.include_router(users.router, prefix="/users", tags=["users"])
