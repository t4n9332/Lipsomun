# ============================================================
#  입소문 관리 도구 (lipsomun.co.kr)
#  - Claude/토큰 없이 데스크톱에서 직접 실행하는 상품 관리 프로그램
#  - 실행: 실행하기.bat 더블클릭
# ============================================================

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# ---------- 설정 (최초 1회 입력 후 ipsomun-config.json에 저장) ----------
$ConfigPath = Join-Path $PSScriptRoot 'ipsomun-config.json'

function Load-Config {
    if (Test-Path $ConfigPath) {
        try { return Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
    }
    return $null
}

function Save-Config($cfg) {
    $cfg | ConvertTo-Json | Out-File -FilePath $ConfigPath -Encoding UTF8
}

$config = Load-Config
if (-not $config -or -not $config.siteUrl -or -not $config.adminPassword) {
    Write-Host ''
    Write-Host '=== 최초 설정 ===' -ForegroundColor Yellow
    $siteUrl = Read-Host '사이트 주소를 입력하세요 (기본: https://lipsomun.co.kr, 엔터로 기본값 사용)'
    if ([string]::IsNullOrWhiteSpace($siteUrl)) { $siteUrl = 'https://lipsomun.co.kr' }
    $pw = Read-Host '관리자 비밀번호를 입력하세요 (Vercel의 ADMIN_PASSWORD 값과 동일)'
    $config = [PSCustomObject]@{ siteUrl = $siteUrl.TrimEnd('/'); adminPassword = $pw }
    Save-Config $config
    Write-Host '설정이 저장되었습니다. (ipsomun-config.json)' -ForegroundColor Green
}

$SiteUrl = $config.siteUrl.TrimEnd('/')

# ---------- 관리자 인증 토큰 (사이트와 동일한 방식: sha256("ipsomun:" + 비밀번호)) ----------
$sha = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes('ipsomun:' + $config.adminPassword))
$Token = ($hashBytes | ForEach-Object { $_.ToString('x2') }) -join ''

# ---------- HTTP 클라이언트 ----------
Add-Type -AssemblyName System.Net.Http
$Client = New-Object System.Net.Http.HttpClient
$Client.Timeout = [TimeSpan]::FromSeconds(120)
$Client.DefaultRequestHeaders.Add('Cookie', "ipsomun_admin=$Token")

function Api-Get($path) {
    $res = $Client.GetAsync($SiteUrl + $path).Result
    $body = $res.Content.ReadAsStringAsync().Result
    if (-not $res.IsSuccessStatusCode) {
        try { $err = ($body | ConvertFrom-Json).error } catch { $err = $body }
        throw "API 오류($([int]$res.StatusCode)): $err"
    }
    return $body | ConvertFrom-Json
}

function Api-Post($path, $obj) {
    $json = $obj | ConvertTo-Json -Depth 8 -Compress
    $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, 'application/json')
    $res = $Client.PostAsync($SiteUrl + $path, $content).Result
    $body = $res.Content.ReadAsStringAsync().Result
    if (-not $res.IsSuccessStatusCode) {
        try { $err = ($body | ConvertFrom-Json).error } catch { $err = $body }
        throw "API 오류($([int]$res.StatusCode)): $err"
    }
    return $body | ConvertFrom-Json
}

# ---------- 카테고리 정의 ----------
$Categories = @('가전/디지털','생활용품','주방용품','식품','뷰티','패션','홈인테리어','스포츠/레저','육아','반려동물','기타')

# 쿠팡 베스트 카테고리 ID 매핑
$BestMap = @(
    @{ id = 1016; name = '가전/디지털' },
    @{ id = 1014; name = '생활용품' },
    @{ id = 1013; name = '주방용품' },
    @{ id = 1012; name = '식품' },
    @{ id = 1010; name = '뷰티' },
    @{ id = 1001; name = '패션' },
    @{ id = 1015; name = '홈인테리어' },
    @{ id = 1017; name = '스포츠/레저' },
    @{ id = 1011; name = '육아' },
    @{ id = 1029; name = '반려동물' }
)

function Select-Category {
    Write-Host ''
    for ($i = 0; $i -lt $Categories.Count; $i++) {
        Write-Host ("  {0}) {1}" -f ($i + 1), $Categories[$i])
    }
    while ($true) {
        $sel = Read-Host '카테고리 번호 선택'
        $n = 0
        if ([int]::TryParse($sel, [ref]$n) -and $n -ge 1 -and $n -le $Categories.Count) {
            return $Categories[$n - 1]
        }
        Write-Host '잘못된 번호입니다. 다시 입력하세요.' -ForegroundColor Red
    }
}

# ---------- 기능 1: 골드박스 갱신 ----------
function Run-Goldbox {
    Write-Host ''
    Write-Host '골드박스(오늘의 특가)를 가져오는 중...' -ForegroundColor Cyan
    $r = Api-Get '/api/cron/goldbox'
    Write-Host ('✔ ' + $r.message) -ForegroundColor Green
}

# ---------- 기능 2: 카테고리 베스트 전체 갱신 ----------
function Run-BestCategories {
    Write-Host ''
    $limit = Read-Host '카테고리당 몇 개씩 가져올까요? (기본 10, 최대 20)'
    if (-not ($limit -match '^\d+$')) { $limit = 10 }
    foreach ($c in $BestMap) {
        try {
            Write-Host ("[{0}] 가져오는 중..." -f $c.name) -ForegroundColor Cyan
            $enc = [System.Uri]::EscapeDataString($c.name)
            $r = Api-Get ("/api/admin/coupang/bestcategory?categoryId={0}&category={1}&limit={2}" -f $c.id, $enc, $limit)
            Write-Host ('  ✔ ' + $r.message) -ForegroundColor Green
        } catch {
            Write-Host ('  ✘ 실패: ' + $_.Exception.Message) -ForegroundColor Red
        }
        Start-Sleep -Milliseconds 800
    }
    Write-Host '카테고리 베스트 갱신 완료!' -ForegroundColor Green
}

# ---------- 기능 3: 키워드로 쿠팡 상품 검색·등록 ----------
function Run-KeywordSearch {
    Write-Host ''
    Write-Host '※ 쿠팡 검색 API는 시간당 호출 횟수 제한(약 10회)이 있습니다.' -ForegroundColor Yellow
    $keyword = Read-Host '검색 키워드 입력 (예: 무선 청소기)'
    if ([string]::IsNullOrWhiteSpace($keyword)) { return }
    $enc = [System.Uri]::EscapeDataString($keyword)
    Write-Host '검색 중...' -ForegroundColor Cyan
    $r = Api-Get ("/api/admin/coupang/search?keyword={0}&limit=10" -f $enc)
    $products = @($r.products)
    if ($products.Count -eq 0) { Write-Host '검색 결과가 없습니다.' -ForegroundColor Red; return }

    Write-Host ''
    for ($i = 0; $i -lt $products.Count; $i++) {
        $p = $products[$i]
        Write-Host ("  {0}) {1}  [{2}원]" -f ($i + 1), $p.productName, ('{0:N0}' -f $p.productPrice))
    }
    Write-Host ''
    $sel = Read-Host '등록할 번호를 쉼표로 입력 (예: 1,3,5 / 전체는 a)'
    $chosen = @()
    if ($sel.Trim().ToLower() -eq 'a') {
        $chosen = $products
    } else {
        foreach ($s in $sel -split ',') {
            $n = 0
            if ([int]::TryParse($s.Trim(), [ref]$n) -and $n -ge 1 -and $n -le $products.Count) {
                $chosen += $products[$n - 1]
            }
        }
    }
    if ($chosen.Count -eq 0) { Write-Host '선택된 상품이 없습니다.'; return }

    $cat = Select-Category
    $dealAns = Read-Host "'오늘의 딜'로 표시할까요? (y/N)"
    $isDeal = ($dealAns.Trim().ToLower() -eq 'y')

    $payload = @()
    foreach ($p in $chosen) {
        $payload += @{
            title    = $p.productName
            imageUrl = $p.productImage
            price    = $p.productPrice
            category = $cat
            isDeal   = $isDeal
            links    = @(@{ platform = 'coupang'; url = $p.productUrl })
        }
    }
    $res = Api-Post '/api/admin/products' $payload
    Write-Host ("✔ {0}개 상품이 [{1}] 카테고리로 등록되었습니다." -f $res.created, $cat) -ForegroundColor Green
}

# ---------- 기능 4: 링크프라이스 URL 일괄 등록 ----------
function Run-Linkprice {
    Write-Host ''
    Write-Host '11번가/오늘의집/G마켓 등 상품 페이지 URL을 한 줄에 하나씩 입력하세요.' -ForegroundColor Cyan
    Write-Host '(입력을 마치려면 빈 줄에서 엔터)'
    $urls = @()
    while ($true) {
        $line = Read-Host ("URL {0}" -f ($urls.Count + 1))
        if ([string]::IsNullOrWhiteSpace($line)) { break }
        if ($line.Trim().StartsWith('http')) { $urls += $line.Trim() }
        else { Write-Host '  http로 시작하는 주소만 가능합니다.' -ForegroundColor Red }
        if ($urls.Count -ge 15) { Write-Host '한 번에 최대 15개까지입니다.'; break }
    }
    if ($urls.Count -eq 0) { return }

    Write-Host '제휴링크 생성 + 상품정보 추출 중... (몇 초 걸릴 수 있어요)' -ForegroundColor Cyan
    $r = Api-Post '/api/admin/linkprice/import' @{ urls = $urls }
    $drafts = @($r.drafts)

    $ok = @()
    Write-Host ''
    for ($i = 0; $i -lt $drafts.Count; $i++) {
        $d = $drafts[$i]
        if ($d.affiliateUrl) {
            $title = if ($d.title) { $d.title } else { '(제목 추출 실패 - 등록 후 관리자에서 수정하세요)' }
            Write-Host ("  ✔ {0}) {1}" -f ($i + 1), $title) -ForegroundColor Green
            $ok += $d
        } else {
            Write-Host ("  ✘ {0}) 변환 실패: {1}" -f ($i + 1), $d.linkError) -ForegroundColor Red
        }
    }
    if ($ok.Count -eq 0) { Write-Host '등록 가능한 상품이 없습니다.'; return }

    $cat = Select-Category
    $payload = @()
    foreach ($d in $ok) {
        $title = if ($d.title) { $d.title } else { $d.originalUrl }
        $payload += @{
            title       = $title
            imageUrl    = "$($d.imageUrl)"
            price       = $d.price
            description = "$($d.description)"
            category    = $cat
            links       = @(@{ platform = $d.platform; url = $d.affiliateUrl })
        }
    }
    $res = Api-Post '/api/admin/products' $payload
    Write-Host ("✔ {0}개 상품이 [{1}] 카테고리로 등록되었습니다." -f $res.created, $cat) -ForegroundColor Green
}

# ---------- 기능 5: 토스쇼핑 하루특가 갱신 ----------
function Run-TossDeals {
    Write-Host ''
    Write-Host '토스쇼핑 하루특가를 가져오는 중... (쉐어링크 자동 발급)' -ForegroundColor Cyan
    $r = Api-Get '/api/cron/tossdeals'
    if ($r.message) { Write-Host ('✔ ' + $r.message) -ForegroundColor Green }
    elseif ($r.error) { Write-Host ('✘ ' + $r.error) -ForegroundColor Red }
}

# ---------- 기능 6: 토스쇼핑 베스트 등록 ----------
function Run-TossBest {
    Write-Host ''
    $limit = Read-Host '몇 개 가져올까요? (기본 20, 최대 50)'
    if (-not ($limit -match '^\d+$')) { $limit = 20 }
    Write-Host '토스쇼핑 베스트셀러를 가져오는 중... (쉐어링크 자동 발급)' -ForegroundColor Cyan
    $r = Api-Get ("/api/admin/toss/best?limit={0}" -f $limit)
    if ($r.message) { Write-Host ('✔ ' + $r.message) -ForegroundColor Green }
    elseif ($r.error) { Write-Host ('✘ ' + $r.error) -ForegroundColor Red }
}

# ---------- 메인 메뉴 ----------
Write-Host ''
Write-Host '============================================' -ForegroundColor DarkYellow
Write-Host '        입 소 문   관 리   도 구' -ForegroundColor Yellow
Write-Host ("        {0}" -f $SiteUrl) -ForegroundColor DarkGray
Write-Host '============================================' -ForegroundColor DarkYellow

while ($true) {
    Write-Host ''
    Write-Host '  1) 골드박스(오늘의 특가) 지금 갱신'
    Write-Host '  2) 카테고리 베스트 전체 갱신 (10개 카테고리)'
    Write-Host '  3) 키워드로 쿠팡 상품 검색 -> 등록'
    Write-Host '  4) 링크프라이스 URL 일괄 등록 (11번가/오늘의집 등)'
    Write-Host '  5) 토스쇼핑 하루특가 지금 갱신 (쉐어링크)'
    Write-Host '  6) 토스쇼핑 베스트셀러 등록 (쉐어링크)'
    Write-Host '  8) 설정 다시 입력 (주소/비밀번호)'
    Write-Host '  9) 종료'
    $menu = Read-Host '메뉴 선택'
    try {
        switch ($menu.Trim()) {
            '1' { Run-Goldbox }
            '2' { Run-BestCategories }
            '3' { Run-KeywordSearch }
            '4' { Run-Linkprice }
            '5' { Run-TossDeals }
            '6' { Run-TossBest }
            '8' { Remove-Item $ConfigPath -ErrorAction SilentlyContinue; Write-Host '설정이 삭제되었습니다. 프로그램을 다시 실행하세요.'; break }
            '9' { break }
            default { Write-Host '1, 2, 3, 4, 5, 6, 8, 9 중에서 선택하세요.' -ForegroundColor Red; continue }
        }
        if ($menu.Trim() -eq '9' -or $menu.Trim() -eq '8') { break }
    } catch {
        Write-Host ('오류: ' + $_.Exception.Message) -ForegroundColor Red
        if ($_.Exception.Message -like '*401*' -or $_.Exception.Message -like '*권한*') {
            Write-Host '비밀번호가 틀렸을 수 있습니다. 메뉴 8로 설정을 다시 입력하세요.' -ForegroundColor Yellow
        }
    }
}

Write-Host '이용해 주셔서 감사합니다!' -ForegroundColor Yellow
