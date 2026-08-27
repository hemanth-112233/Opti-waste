from typing import Optional
from fastapi import Header, HTTPException, Depends, status
from uuid import UUID
from app.models.user import User

# This is a stub for the existing JWT authentication as requested in Phase 3
# In a real setup, this decodes the token and gets the user from DB.
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Mocking returning a default user for Phase 4 testing without true JWT logic
    token = authorization.split(" ")[1]
    
    # We would normally query User model here
    user = User(
        id=UUID("00000000-0000-0000-0000-000000000000"),
        name="Mock User",
        email="mock@example.com",
        password_hash="...",
        role=None, # In real app, Link[Role]
        is_active=True
    )
    # We add a dummy role name to use in RBAC below.
    # We use a setattr to avoid Pydantic errors if we mock poorly.
    setattr(user, "role_name_mock", "Administrator" if token == "admin" else "Viewer") 
    
    # Check "admin" token logic for testing
    if token == "engineer":
        setattr(user, "role_name_mock", "Cloud Engineer")
    elif token == "analyst":
        setattr(user, "role_name_mock", "FinOps Analyst")
        
    return user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    role = getattr(current_user, "role_name_mock", "")
    if role not in ["Administrator"]:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user

async def get_current_engineer(current_user: User = Depends(get_current_user)):
    role = getattr(current_user, "role_name_mock", "")
    if role not in ["Administrator", "Cloud Engineer"]:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user

async def get_current_analyst(current_user: User = Depends(get_current_user)):
    role = getattr(current_user, "role_name_mock", "")
    if role not in ["Administrator", "Cloud Engineer", "FinOps Analyst"]:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user
