@echo off
setlocal enabledelayedexpansion

set BASE=http://localhost:8001/api/v1
set CT=-H "Content-Type: application/json"

echo.
echo === TEST 0: Health ===
curl -s -m 5 http://localhost:8001/health

echo.
echo === TEST A: Signup (Yasin) ===
curl -s -w " [HTTP %%{http_code}]" -m 10 -X POST %BASE%/auth/signup %CT% --data @tmp_signup.json

echo.
echo === TEST B: Login (email field) ===
for /f "delims=" %%i in ('curl -s -m 10 -X POST %BASE%/auth/login %CT% --data @tmp_login.json') do set LOGIN_RESP=%%i
echo !LOGIN_RESP!

REM Extract access_token using PowerShell (from the login response)
for /f "delims=" %%t in ('powershell -Command "('!LOGIN_RESP!' | ConvertFrom-Json).access_token"') do set TOKEN1=%%t
for /f "delims=" %%r in ('powershell -Command "('!LOGIN_RESP!' | ConvertFrom-Json).refresh_token"') do set REFRESH1=%%r
for /f "delims=" %%n in ('powershell -Command "('!LOGIN_RESP!' | ConvertFrom-Json).user.name"') do set NAME1=%%n
echo Token1 obtained: !TOKEN1:~0,30!...
echo User name: !NAME1!

echo.
echo === TEST C: /auth/me (should return Yasin Kumar) ===
curl -s -m 10 %BASE%/auth/me -H "Authorization: Bearer !TOKEN1!"

echo.
echo === TEST D: Resource Dashboard Summary ===
curl -s -m 10 %BASE%/resources/dashboard/summary -H "Authorization: Bearer !TOKEN1!"

echo.
echo === TEST E: Metrics Dashboard ===
curl -s -m 10 %BASE%/metrics/dashboard -H "Authorization: Bearer !TOKEN1!"

echo.
echo === TEST F: Costs Dashboard ===
curl -s -m 10 %BASE%/costs/dashboard -H "Authorization: Bearer !TOKEN1!"

echo.
echo === TEST G: Providers ===
curl -s -m 10 %BASE%/providers -H "Authorization: Bearer !TOKEN1!"

echo.
echo === TEST H: 401 without token ===
curl -s -w " [HTTP %%{http_code}]" -m 5 %BASE%/resources

echo.
echo === TEST I: Refresh Token ===
powershell -Command "$r='!REFRESH1!'; $b='{\"refresh_token\":\"'+$r+'\"}'; Invoke-RestMethod -Uri '!BASE!/auth/refresh' -Method POST -ContentType 'application/json' -Body $b -TimeoutSec 10 | ConvertTo-Json -Depth 3" 2>&1

echo.
echo === TEST J: Logout ===
curl -s -m 5 -X POST %BASE%/auth/logout -H "Authorization: Bearer !TOKEN1!"

echo.
echo === TEST K: User Switching ===
curl -s -w " [signup HTTP %%{http_code}]" -m 10 -X POST %BASE%/auth/signup %CT% --data @tmp_signup2.json
echo.
for /f "delims=" %%i in ('curl -s -m 10 -X POST %BASE%/auth/login %CT% --data @tmp_login2.json') do set LOGIN2=%%i
for /f "delims=" %%t in ('powershell -Command "('!LOGIN2!' | ConvertFrom-Json).access_token"') do set TOKEN2=%%t
for /f "delims=" %%n in ('powershell -Command "('!LOGIN2!' | ConvertFrom-Json).user.name"') do set NAME2=%%n
echo User2 login name: !NAME2!

echo.
echo User1 /me (expect Yasin Kumar):
curl -s -m 10 %BASE%/auth/me -H "Authorization: Bearer !TOKEN1!"
echo.
echo User2 /me (expect Test User):
curl -s -m 10 %BASE%/auth/me -H "Authorization: Bearer !TOKEN2!"

echo.
echo ========================================
echo ALL TESTS COMPLETE
echo ========================================
