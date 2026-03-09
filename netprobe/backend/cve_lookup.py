"""
NetProbe - CVE Lookup Engine
Queries NVD API 2.0 for CVEs based on detected services/versions.
"""
import asyncio, re, httpx

NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"

SERVICE_CPE_MAP = {
    "apache":"apache:http_server","nginx":"nginx:nginx",
    "openssh":"openbsd:openssh","ssh":"openbsd:openssh",
    "vsftpd":"vsftpd:vsftpd","proftpd":"proftpd:proftpd",
    "mysql":"mysql:mysql","mariadb":"mariadb:mariadb",
    "postgresql":"postgresql:postgresql","postgres":"postgresql:postgresql",
    "microsoft-ds":"microsoft:windows","smb":"microsoft:windows",
    "iis":"microsoft:iis","tomcat":"apache:tomcat","php":"php:php",
    "openssl":"openssl:openssl","samba":"samba:samba",
    "bind":"isc:bind","named":"isc:bind","postfix":"postfix:postfix",
    "exim":"exim:exim","sendmail":"sendmail:sendmail",
    "dovecot":"dovecot:dovecot","redis":"redis:redis",
    "mongodb":"mongodb:mongodb","elasticsearch":"elastic:elasticsearch",
    "docker":"docker:docker","wordpress":"wordpress:wordpress",
    "joomla":"joomla:joomla","drupal":"drupal:drupal",
}

SEVERITY_ORDER = {"CRITICAL":0,"HIGH":1,"MEDIUM":2,"LOW":3,"NONE":4}


def extract_service_version(banner):
    patterns = [
        r"(Apache)\s+httpd\s+([\d.]+)",r"(nginx)/([\d.]+)",
        r"(OpenSSH)\s+([\d.p]+)",r"(vsftpd)\s+([\d.]+)",
        r"(MySQL)\s+([\d.]+)",r"(PostgreSQL)\s+([\d.]+)",
        r"(Samba)\s+smbd\s+([\d.]+)",r"(ProFTPD)\s+([\d.]+)",
        r"(Dovecot)\s+([\d.]+)",r"(Redis)\s+([\d.]+)",
        r"(MongoDB)\s+([\d.]+)",r"(Exim)\s+([\d.]+)",
    ]
    for pat in patterns:
        m = re.search(pat, banner, re.I)
        if m:
            return m.group(1).lower(), m.group(2) if m.lastindex >= 2 else ""
    words = banner.split()
    return (words[0].lower() if words else ""), ""


async def lookup_cves_for_service(service, version="", max_results=5):
    query = f"{service} {version}".strip() if version else service
    params = {"keywordSearch": query, "resultsPerPage": max_results}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(NVD_API, params=params)
            if resp.status_code == 403:
                # Rate limited — try with delay
                await asyncio.sleep(2)
                resp = await client.get(NVD_API, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
    except Exception:
        return []

    cves = []
    for item in data.get("vulnerabilities", []):
        cve    = item.get("cve", {})
        cve_id = cve.get("id", "")
        metrics = cve.get("metrics", {})
        cvss_score, severity, cvss_ver = None, "NONE", "N/A"
        for key in ["cvssMetricV31","cvssMetricV30","cvssMetricV2"]:
            entries = metrics.get(key, [])
            if entries:
                cd = entries[0].get("cvssData", {})
                cvss_score = cd.get("baseScore")
                severity   = (cd.get("baseSeverity") or entries[0].get("baseSeverity","NONE")).upper()
                cvss_ver   = cd.get("version", key)
                break
        descs = cve.get("descriptions", [])
        desc  = next((d["value"] for d in descs if d.get("lang")=="en"), "")[:350]
        refs  = cve.get("references", [])
        has_exploit = any("exploit" in (r.get("url","")+str(r.get("tags",""))).lower() for r in refs)
        patch_url   = next((r["url"] for r in refs if any(t in r.get("tags",[]) for t in ["Patch","Vendor Advisory"])), None)
        cves.append({
            "id": cve_id, "score": cvss_score, "severity": severity,
            "cvss_ver": cvss_ver, "description": desc,
            "published": cve.get("published","")[:10],
            "has_exploit": has_exploit, "patch_url": patch_url,
            "nvd_url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
        })

    cves.sort(key=lambda c: (SEVERITY_ORDER.get(c["severity"],9), -(c["score"] or 0)))
    return cves


async def lookup_cves_for_host(services, banners=None, max_per=3):
    all_svcs, seen = list(services), set()
    if banners:
        for b in banners:
            svc, ver = extract_service_version(b)
            if svc:
                all_svcs.append(f"{svc}/{ver}" if ver else svc)

    tasks, task_keys = [], []
    for svc in all_svcs[:8]:
        if svc in seen: continue
        seen.add(svc)
        name, ver = (svc.split("/",1) + [""])[:2]
        tasks.append(lookup_cves_for_service(name, ver, max_per))
        task_keys.append(svc)

    results = {}
    if tasks:
        lists = await asyncio.gather(*tasks, return_exceptions=True)
        for svc, lst in zip(task_keys, lists):
            if isinstance(lst, list) and lst:
                results[svc] = lst
    return results


def register_cve_routes(app):
    from pydantic import BaseModel

    class CVERequest(BaseModel):
        services: list = []
        banners:  list = []
        query:    str  = ""

    @app.post("/api/cve/lookup")
    async def cve_lookup(req: CVERequest):
        if req.query:
            cves = await lookup_cves_for_service(req.query, max_results=10)
            return {"results": {"query": cves}, "total": len(cves)}
        results = await lookup_cves_for_host(req.services, req.banners)
        total   = sum(len(v) for v in results.values())
        return {"results": results, "total": total}

    @app.get("/api/cve/search")
    async def cve_search(q: str, limit: int = 10):
        cves = await lookup_cves_for_service(q, max_results=min(limit, 20))
        return {"cves": cves, "query": q}
