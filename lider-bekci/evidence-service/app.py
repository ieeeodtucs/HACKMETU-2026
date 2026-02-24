"""
Compliance Evidence Service — FastAPI Application

Microservice providing REST endpoints for the Lider Compliance Dashboard.
Runs on port 5000, stores data in SQLite.
"""
import os
import threading
import time
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import json

from database import get_db, init_db
from models import Client, PolicyDefinition, EvidenceLog
from lider_sync import sync_agents_from_lider, ensure_policies_exist
from seed_data import seed

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="Compliance Evidence Service",
    description="Politika doğrulama ve uyum izleme mikroservisi",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _periodic_sync():
    """Arka planda periyodik olarak senkronizasyon yapar"""
    while True:
        try:
            sync_agents_from_lider()
        except:
            pass
        time.sleep(15)  # 15 saniyede bir eşitle

@app.on_event("startup")
def on_startup():
    """Initialize DB and sync agents from Lider MySQL on startup"""
    init_db()
    result = sync_agents_from_lider()
    ensure_policies_exist()
    if result <= 0:
        # Fallback to seed data if MySQL is unavailable
        from database import SessionLocal
        db = SessionLocal()
        if db.query(Client).count() == 0:
            seed()
        db.close()
    
    # Arka plan senkronizasyon thread'ini başlat
    t = threading.Thread(target=_periodic_sync, daemon=True)
    t.start()


# ── Pydantic Schemas ──────────────────────────────────────────

class HeartbeatPayload(BaseModel):
    hostname: str
    username: str

class EvidenceReport(BaseModel):
    """Schema for client-submitted evidence reports"""
    hostname: str
    policy: str
    result: str  # compliant | non_compliant
    detail: str


class DeployRequest(BaseModel):
    """Schema for plugin deployment request"""
    target_clients: Optional[list] = None  # None = all uninstalled


# ── Helper ────────────────────────────────────────────────────

def client_to_dict(c: Client) -> dict:
    violations = []
    if c.violations:
        try:
            violations = json.loads(c.violations)
        except (json.JSONDecodeError, TypeError):
            violations = []
    return {
        "id": c.id,
        "hostname": c.hostname,
        "ip": c.ip,
        "os": c.os,
        "pluginStatus": c.plugin_status,
        "lastCheck": c.last_check.isoformat() if c.last_check else None,
        "complianceStatus": c.compliance_status,
        "complianceScore": c.compliance_score,
        "online": c.online,
        "violations": violations,
    }


# ══════════════════════════════════════════════════════════════
#  REST ENDPOINTS — consumed by the Vue.js frontend
# ══════════════════════════════════════════════════════════════

@app.get("/api/compliance/summary")
def get_compliance_summary(db: Session = Depends(get_db)):
    """Compliance özet metrikleri"""
    clients = db.query(Client).all()
    total = len(clients)
    compliant = sum(1 for c in clients if c.compliance_status == "compliant")
    non_compliant = sum(1 for c in clients if c.compliance_status == "non_compliant")
    pending = sum(1 for c in clients if c.compliance_status == "pending")
    installed = sum(1 for c in clients if c.plugin_status == "installed")
    not_installed = sum(1 for c in clients if c.plugin_status == "not_installed")
    online = sum(1 for c in clients if c.online)
    offline = sum(1 for c in clients if not c.online)

    # Calculate compliance rate
    checked = compliant + non_compliant
    rate = round((compliant / checked) * 100, 1) if checked > 0 else 0

    # Violation counts from evidence logs
    logs = db.query(EvidenceLog).all()
    critical_policies = {"SSH Güvenlik Politikası", "Firewall Politikası", "Disk Şifreleme Politikası"}
    critical_violations = sum(1 for l in logs if l.result == "non_compliant" and l.policy in critical_policies)
    warning_violations = sum(1 for l in logs if l.result == "non_compliant" and l.policy not in critical_policies)

    # Drift: clients whose score dropped (simplified: non_compliant with score > 0)
    drift = sum(1 for c in clients if c.compliance_status == "non_compliant" and c.compliance_score > 0)

    # Last scan
    last_checks = [c.last_check for c in clients if c.last_check]
    last_scan = max(last_checks).isoformat() if last_checks else None

    return {
        "totalClients": total,
        "compliantClients": compliant,
        "nonCompliantClients": non_compliant,
        "pendingClients": pending,
        "pluginInstalledClients": installed,
        "pluginNotInstalledClients": not_installed,
        "onlineClients": online,
        "offlineClients": offline,
        "complianceRate": rate,
        "lastScanDate": last_scan,
        "criticalViolations": critical_violations,
        "warningViolations": warning_violations,
        "driftDetected": drift,
    }


@app.get("/api/compliance/clients")
def get_clients(db: Session = Depends(get_db)):
    """Tüm istemcilerin listesi"""
    clients = db.query(Client).all()
    return [client_to_dict(c) for c in clients]


@app.get("/api/compliance/policy-results")
def get_policy_results(db: Session = Depends(get_db)):
    """Politika bazlı uyum sonuçları"""
    policies = db.query(PolicyDefinition).all()
    return [
        {
            "id": p.id,
            "policyName": p.policy_name,
            "description": p.description,
            "totalChecked": p.total_checked,
            "compliant": p.compliant,
            "nonCompliant": p.non_compliant,
            "complianceRate": p.compliance_rate,
            "severity": p.severity,
            "category": p.category,
            "active": p.active if p.active is not None else False,
        }
        for p in policies
    ]


@app.get("/api/compliance/evidence-logs")
def get_evidence_logs(db: Session = Depends(get_db)):
    """Kanıt kayıtları (son 100)"""
    logs = db.query(EvidenceLog).order_by(EvidenceLog.timestamp.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "client": l.client,
            "policy": l.policy,
            "result": l.result,
            "detail": l.detail,
        }
        for l in logs
    ]


import requests
import subprocess
import os

def _simulate_client_verification(targets_info):
    """
    Arka planda çalışarak, dağıtım yapılan istemcilerde (Hackathon demosu için)
    XMPP simülasyonunu başlatır.
    """
    time.sleep(1)  # Arayüzün yüklenmesi için kısa bir gecikme
    
    agent_path = os.path.join(os.path.dirname(__file__), "usb_anomaly_agent.py")
    
    for t in targets_info:
        hostname = t["hostname"]
        ip = t["ip"]

        try:
            username = hostname.split("@")[0] if "@" in hostname else "demo-ali"
            
            # 1. İstemcinin bağlandığını (heartbeat) Lider'e bildir
            hb_payload = {"hostname": hostname, "username": username}
            requests.post("http://127.0.0.1:5000/api/compliance/heartbeat", json=hb_payload, timeout=2)

            # 2. XMPP/Ejabberd simülasyonu: Ajanı yerel alt süreç olarak başlatarak ML API'sinden HTTP ile veri çek
            print(f">>> LiderAhenk XMPP Simülasyonu: {ip} üzerinden veri çekiliyor...")
            subprocess.Popen(["python3", agent_path, hostname, ip])
            
        except Exception as e:
            print(f"[{hostname}] XMPP/Ahenk Baglanti Hatasi: {e}")


@app.post("/api/compliance/deploy")
def deploy_plugin(req: DeployRequest = None, db: Session = Depends(get_db)):
    """
    Plugin'i kurulmamış istemcilere dağıt.
    Gerçek ortamda XMPP üzerinden Ahenk ajanına komut gönderilir;
    burada DB durumunu güncelliyoruz ve istemcinin doğrulama dönüşünü simüle ediyoruz.
    """
    if req and req.target_clients:
        targets = db.query(Client).filter(Client.hostname.in_(req.target_clients)).all()
    else:
        targets = db.query(Client).filter(Client.plugin_status == "not_installed").all()

    count = 0
    targets_info = []
    for client in targets:
        client.plugin_status = "installed"
        client.compliance_status = "pending"
        targets_info.append({"hostname": client.hostname, "ip": client.ip})
        count += 1

    db.commit()

    if targets_info:
        t = threading.Thread(target=_simulate_client_verification, args=(targets_info,), daemon=True)
        t.start()

    return {
        "success": True,
        "message": "Plugin dağıtımı başlatıldı. İstemcilerden doğrulama bekleniyor...",
        "deployedCount": count,
    }


# ══════════════════════════════════════════════════════════════
#  CLIENT REPORTING ENDPOINT — used by Ahenk agents
# ══════════════════════════════════════════════════════════════

@app.post("/api/compliance/report")
def submit_evidence(report: EvidenceReport, db: Session = Depends(get_db)):
    """
    İstemciden gelen compliance kanıt raporu.
    Ahenk ajanı bu endpoint'e sonuçları POST eder.
    """
    # Log the evidence
    log = EvidenceLog(
        timestamp=datetime.utcnow(),
        client=report.hostname,
        policy=report.policy,
        result=report.result,
        detail=report.detail,
    )
    db.add(log)

    # ── Update policy stats ──
    policy_def = db.query(PolicyDefinition).filter(
        PolicyDefinition.policy_name == report.policy
    ).first()
    if policy_def:
        policy_def.total_checked += 1
        if report.result == "compliant":
            policy_def.compliant += 1
        else:
            policy_def.non_compliant += 1
        total = policy_def.compliant + policy_def.non_compliant
        policy_def.compliance_rate = round((policy_def.compliant / max(total, 1)) * 100, 1)

    # ── Update client status ──
    # Try exact match first, then partial match (hostname might be "ali@pardus")
    client = db.query(Client).filter(Client.hostname == report.hostname).first()
    if not client:
        # Try matching by hostname substring (e.g. report.hostname="pardus" matches "ali@pardus")
        client = db.query(Client).filter(
            Client.hostname.contains(report.hostname)
        ).first()
    if not client:
        # Try matching with username@hostname pattern
        client = db.query(Client).filter(
            Client.hostname.contains(f"@{report.hostname}")
        ).first()

    if client:
        client.last_check = datetime.utcnow()
        client.online = True
        client.plugin_status = "installed"

        if report.result == "non_compliant":
            # Add violation
            violations = []
            if client.violations:
                try:
                    violations = json.loads(client.violations)
                except (json.JSONDecodeError, TypeError):
                    violations = []
            violation_text = f"{report.policy}: {report.detail[:100]}"
            if violation_text not in violations:
                violations.append(violation_text)
            client.violations = json.dumps(violations, ensure_ascii=False)
            client.compliance_status = "non_compliant"
        else:
            # Remove this policy from violations if it was there before
            if client.violations:
                try:
                    violations = json.loads(client.violations)
                    violations = [v for v in violations if not v.startswith(report.policy + ":")]
                    client.violations = json.dumps(violations, ensure_ascii=False) if violations else None
                except (json.JSONDecodeError, TypeError):
                    pass

            # Check if all evidence for this client is now compliant
            non_compliant_count = db.query(EvidenceLog).filter(
                EvidenceLog.client == report.hostname,
                EvidenceLog.result == "non_compliant",
            ).count()
            if non_compliant_count == 0:
                client.compliance_status = "compliant"

        # Recalculate compliance score
        total_policies = db.query(PolicyDefinition).count()
        if total_policies > 0:
            # Count distinct policies where this client is non-compliant
            violation_list = []
            if client.violations:
                try:
                    violation_list = json.loads(client.violations)
                except (json.JSONDecodeError, TypeError):
                    pass
            non_compliant_policies = len(violation_list)
            client.compliance_score = max(0, int(100 - (non_compliant_policies / total_policies) * 100))

    db.commit()
    return {"status": "ok", "message": "Evidence recorded"}


# ══════════════════════════════════════════════════════════════
#  Admin endpoints
# ══════════════════════════════════════════════════════════════

@app.post("/api/compliance/sync")
def sync_from_lider():
    """Lider MySQL'den agent verilerini yeniden senkronize et"""
    count = sync_agents_from_lider()
    if count > 0:
        return {"status": "ok", "message": f"{count} agent senkronize edildi", "syncedCount": count}
    return {"status": "error", "message": "MySQL bağlantı hatası veya agent bulunamadı", "syncedCount": 0}


@app.post("/api/compliance/heartbeat")
def client_heartbeat(payload: HeartbeatPayload, db: Session = Depends(get_db)):
    """
    İstemciden gelen kalp atışı.
    İstemcinin online olduğunu ve Lider ile bağlantıda olduğunu gösterir.
    (İlerleyen aşamada Agentic sistemin dönüş çağrısı olarak kullanılacak)
    """
    # Try username@hostname first, then fallback to partial
    client = db.query(Client).filter(Client.hostname == f"{payload.username}@{payload.hostname}").first()
    if not client:
        client = db.query(Client).filter(Client.hostname.contains(payload.hostname)).first()
    
    if client:
        client.last_check = datetime.utcnow()
        client.online = True
        client.plugin_status = "installed"
        db.commit()
        return {"status": "ok", "message": "Heartbeat received"}
    
    return {"status": "warning", "message": "Client not found in compliance DB"}


# ══════════════════════════════════════════════════════════════
#  Health check
# ══════════════════════════════════════════════════════════════

@app.get("/api/compliance/health")
def health():
    return {"status": "up", "service": "evidence-service", "timestamp": datetime.utcnow().isoformat()}


# ── Run ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
