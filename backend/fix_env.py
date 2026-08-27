import os

env_path = r'c:\Users\haswa\OneDrive\Documents\optiwaste\backend\.env'

# Write clean .env from scratch with all required values
content = """PORT=8001
MONGODB_URI=mongodb://localhost:27017/optiwaste
JWT_SECRET=super_secret_jwt_key_123
JWT_REFRESH_SECRET=super_secret_refresh_key_456
TOKEN_EXPIRY=1h
REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://localhost:5174","http://localhost:5175"]
"""

with open(env_path, 'w', newline='\n') as f:
    f.write(content)

print('Written:')
print(repr(open(env_path).read()))
