$b = "http://localhost:8001/api/v1"

function Post-Json($url, $body, $token) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $r = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -ErrorAction Stop
        return @{ ok = $true; code = $r.StatusCode; data = ($r.Content | ConvertFrom-Json) }
    } catch [System.Net.WebException] {
        $code = [int]$_.Exception.Response.StatusCode
        $content = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
        return @{ ok = $false; code = $code; data = ($content | ConvertFrom-Json -ErrorAction SilentlyContinue); raw = $content }
    }
}

function Get-Json($url, $token) {
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        $r = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -ErrorAction Stop
        return @{ ok = $true; code = $r.StatusCode; data = ($r.Content | ConvertFrom-Json) }
    } catch [System.Net.WebException] {
        $code = [int]$_.Exception.Response.StatusCode
        return @{ ok = $false; code = $code }
    }
}

$passed = 0
$failed = 0

function Check($name, $condition, $msg) {
    if ($condition) {
        Write-Host "  PASS: $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  FAIL: $name -- $msg" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "=== HEALTH ===" -ForegroundColor Cyan
$health = Get-Json "http://localhost:8001/health"
Check "Health 200" ($health.ok) "Server not reachable"
Check "Health success" ($health.data.success -eq $true) "success!=true"

Write-Host "=== SIGNUP (yasin) ===" -ForegroundColor Cyan
$su = Post-Json "$b/auth/signup" '{"name":"Yasin Kumar","email":"yasin127@gmail.com","password":"Password123!"}'
if ($su.code -eq 201) { Check "Signup 201" $true "" }
elseif ($su.code -eq 400) { Check "Signup already exists (OK)" $true "" }
else { Check "Signup" $false "code=$($su.code) raw=$($su.raw)" }

Write-Host "=== LOGIN (email field) ===" -ForegroundColor Cyan
$li = Post-Json "$b/auth/login" '{"email":"yasin127@gmail.com","password":"Password123!"}'
Check "Login 200" ($li.code -eq 200) "code=$($li.code) raw=$($li.raw)"
Check "Login success=true" ($li.data.success -eq $true) "success field missing"
Check "Login has access_token" ($li.data.access_token -ne $null) ""
Check "Login has user.name" ($li.data.user.name -ne $null) ""
Check "Login user is Yasin" ($li.data.user.name -eq "Yasin Kumar") "got $($li.data.user.name)"
$token1 = $li.data.access_token
$refresh1 = $li.data.refresh_token

Write-Host "=== /auth/me (Yasin) ===" -ForegroundColor Cyan
$me1 = Get-Json "$b/auth/me" $token1
Check "/me 200" ($me1.code -eq 200) "code=$($me1.code)"
Check "/me success" ($me1.data.success -eq $true) ""
Check "/me name=Yasin Kumar" ($me1.data.user.name -eq "Yasin Kumar") "got $($me1.data.user.name)"
Check "/me no password in response" ($me1.data.user.password_hash -eq $null) "password_hash exposed!"

Write-Host "=== DASHBOARD ENDPOINTS ===" -ForegroundColor Cyan
$rs = Get-Json "$b/resources/dashboard/summary" $token1
Check "Resource Summary 200" ($rs.code -eq 200) "code=$($rs.code)"

$md = Get-Json "$b/metrics/dashboard" $token1
Check "Metrics Dashboard 200" ($md.code -eq 200) "code=$($md.code)"

$cd = Get-Json "$b/costs/dashboard" $token1
Check "Costs Dashboard 200" ($cd.code -eq 200) "code=$($cd.code)"

$pv = Get-Json "$b/providers" $token1
Check "Providers 200" ($pv.code -eq 200) "code=$($pv.code)"

$rv = Get-Json "$b/resources" $token1
Check "Resources 200" ($rv.code -eq 200) "code=$($rv.code)"

Write-Host "=== REFRESH TOKEN ===" -ForegroundColor Cyan
$body_rf = "{""refresh_token"":""$refresh1""}"
$rf = Post-Json "$b/auth/refresh" $body_rf
Check "Refresh 200" ($rf.code -eq 200) "code=$($rf.code) raw=$($rf.raw)"
Check "Refresh new token" ($rf.data.access_token -ne $null) ""
Check "Refresh user.name" ($rf.data.user.name -eq "Yasin Kumar") "got $($rf.data.user.name)"

Write-Host "=== LOGOUT ===" -ForegroundColor Cyan
$lo = Post-Json "$b/auth/logout" '{}' $token1
Check "Logout 200" ($lo.code -eq 200) "code=$($lo.code)"
Check "Logout success" ($lo.data.success -eq $true) ""

Write-Host "=== 401 WITHOUT TOKEN ===" -ForegroundColor Cyan
$no_auth = Get-Json "$b/resources"
Check "No token = 401" ($no_auth.code -eq 401) "got $($no_auth.code)"

Write-Host "=== USER SWITCHING ===" -ForegroundColor Cyan
Post-Json "$b/auth/signup" '{"name":"Test User","email":"testuser@optiwaste.com","password":"Password456!"}' | Out-Null
$li2 = Post-Json "$b/auth/login" '{"email":"testuser@optiwaste.com","password":"Password456!"}'
Check "Login user2" ($li2.code -eq 200) "code=$($li2.code)"
$token2 = $li2.data.access_token

$meA = Get-Json "$b/auth/me" $token1
$meB = Get-Json "$b/auth/me" $token2
Check "Token1 /me = Yasin Kumar" ($meA.data.user.name -eq "Yasin Kumar") "got $($meA.data.user.name)"
Check "Token2 /me = Test User" ($meB.data.user.name -eq "Test User") "got $($meB.data.user.name)"
Check "User isolation OK" ($meA.data.user.name -ne $meB.data.user.name) "both returned same user"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PASSED: $passed   FAILED: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "=========================================" -ForegroundColor Cyan
