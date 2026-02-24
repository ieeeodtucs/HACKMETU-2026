import axios from "axios";

// API endpoints (for future real backend integration)
const complianceSummaryUrl = '/api/compliance/summary';
const complianceClientsUrl = '/api/compliance/clients';
const compliancePolicyResultsUrl = '/api/compliance/policy-results';
const complianceEvidenceLogsUrl = '/api/compliance/evidence-logs';
const complianceDeployUrl = '/api/compliance/deploy';

// Mock data flag - set to false when real backend is available
const USE_MOCK_DATA = false;

const mockSummary = {
    totalClients: 48,
    compliantClients: 31,
    nonCompliantClients: 12,
    pendingClients: 5,
    pluginInstalledClients: 43,
    pluginNotInstalledClients: 5,
    onlineClients: 36,
    offlineClients: 12,
    complianceRate: 72.1,
    lastScanDate: "2026-02-21T19:30:00",
    criticalViolations: 7,
    warningViolations: 15,
    driftDetected: 3
};

const mockClients = [
    { id: 1, hostname: "pardus-pc-001", ip: "192.168.1.10", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:25:00", complianceStatus: "compliant", complianceScore: 100, online: true },
    { id: 2, hostname: "pardus-pc-002", ip: "192.168.1.11", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:28:00", complianceStatus: "compliant", complianceScore: 100, online: true },
    { id: 3, hostname: "pardus-pc-003", ip: "192.168.1.12", os: "Pardus 21", pluginStatus: "installed", lastCheck: "2026-02-21T18:45:00", complianceStatus: "non_compliant", complianceScore: 60, online: true, violations: ["SSH root erişimi açık", "Firewall devre dışı"] },
    { id: 4, hostname: "pardus-pc-004", ip: "192.168.1.13", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:30:00", complianceStatus: "compliant", complianceScore: 95, online: true },
    { id: 5, hostname: "pardus-pc-005", ip: "192.168.1.14", os: "Pardus 23", pluginStatus: "not_installed", lastCheck: null, complianceStatus: "pending", complianceScore: 0, online: true },
    { id: 6, hostname: "pardus-pc-006", ip: "192.168.1.15", os: "Pardus 21", pluginStatus: "installed", lastCheck: "2026-02-21T17:10:00", complianceStatus: "non_compliant", complianceScore: 45, online: false, violations: ["Parola politikası uyumsuz", "USB kısıtlaması yok", "NTP yapılandırılmamış"] },
    { id: 7, hostname: "pardus-pc-007", ip: "192.168.1.16", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:20:00", complianceStatus: "compliant", complianceScore: 100, online: true },
    { id: 8, hostname: "pardus-pc-008", ip: "192.168.1.17", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:15:00", complianceStatus: "compliant", complianceScore: 90, online: true },
    { id: 9, hostname: "pardus-pc-009", ip: "192.168.1.18", os: "Pardus 21", pluginStatus: "not_installed", lastCheck: null, complianceStatus: "pending", complianceScore: 0, online: false },
    { id: 10, hostname: "pardus-pc-010", ip: "192.168.1.19", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T16:50:00", complianceStatus: "non_compliant", complianceScore: 70, online: true, violations: ["Güncel olmayan paketler"] },
    { id: 11, hostname: "pardus-pc-011", ip: "192.168.1.20", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:29:00", complianceStatus: "compliant", complianceScore: 100, online: true },
    { id: 12, hostname: "pardus-pc-012", ip: "192.168.1.21", os: "Pardus 23", pluginStatus: "installed", lastCheck: "2026-02-21T19:00:00", complianceStatus: "compliant", complianceScore: 85, online: false },
];

const mockPolicyResults = [
    { id: 1, policyName: "SSH Güvenlik Politikası", description: "Root SSH girişi kapatılmalı, anahtar tabanlı kimlik doğrulama zorunlu", totalChecked: 43, compliant: 38, nonCompliant: 5, complianceRate: 88.4, severity: "critical", category: "security" },
    { id: 2, policyName: "Firewall Politikası", description: "UFW/iptables aktif olmalı, sadece izin verilen portlar açık", totalChecked: 43, compliant: 40, nonCompliant: 3, complianceRate: 93.0, severity: "critical", category: "security" },
    { id: 3, policyName: "Parola Politikası", description: "Minimum 12 karakter, büyük-küçük harf, rakam ve özel karakter zorunlu", totalChecked: 43, compliant: 35, nonCompliant: 8, complianceRate: 81.4, severity: "high", category: "authentication" },
    { id: 4, policyName: "USB Kısıtlama Politikası", description: "Yetkisiz USB cihazları engellenmeli", totalChecked: 43, compliant: 41, nonCompliant: 2, complianceRate: 95.3, severity: "medium", category: "device" },
    { id: 5, policyName: "NTP Senkronizasyonu", description: "Sistem saati NTP sunucusu ile senkronize olmalı", totalChecked: 43, compliant: 39, nonCompliant: 4, complianceRate: 90.7, severity: "low", category: "configuration" },
    { id: 6, policyName: "Paket Güncellik Politikası", description: "Güvenlik güncellemeleri 7 gün içinde uygulanmalı", totalChecked: 43, compliant: 30, nonCompliant: 13, complianceRate: 69.8, severity: "high", category: "update" },
    { id: 7, policyName: "Disk Şifreleme Politikası", description: "LUKS disk şifreleme aktif olmalı", totalChecked: 43, compliant: 42, nonCompliant: 1, complianceRate: 97.7, severity: "critical", category: "security" },
    { id: 8, policyName: "Log Yönetimi Politikası", description: "rsyslog aktif olmalı, loglar merkezi sunucuya iletilmeli", totalChecked: 43, compliant: 37, nonCompliant: 6, complianceRate: 86.0, severity: "medium", category: "monitoring" },
];

const mockEvidenceLogs = [
    { id: 1, timestamp: "2026-02-21T19:30:00", client: "pardus-pc-003", policy: "SSH Güvenlik Politikası", result: "non_compliant", detail: "Root SSH girişi aktif durumda. /etc/ssh/sshd_config dosyasında PermitRootLogin=yes" },
    { id: 2, timestamp: "2026-02-21T19:28:00", client: "pardus-pc-002", policy: "Firewall Politikası", result: "compliant", detail: "UFW aktif. Sadece 22, 80, 443 portları açık." },
    { id: 3, timestamp: "2026-02-21T19:25:00", client: "pardus-pc-001", policy: "Parola Politikası", result: "compliant", detail: "PAM konfigürasyonu uyumlu. Minimum 12 karakter, karmaşıklık kuralları aktif." },
    { id: 4, timestamp: "2026-02-21T19:20:00", client: "pardus-pc-006", policy: "USB Kısıtlama Politikası", result: "non_compliant", detail: "USB kısıtlama kuralı tanımlı değil. udev kuralları eksik." },
    { id: 5, timestamp: "2026-02-21T19:15:00", client: "pardus-pc-008", policy: "NTP Senkronizasyonu", result: "compliant", detail: "chrony servisi aktif. Sunucu: ntp.pardus.org.tr ile senkronize." },
    { id: 6, timestamp: "2026-02-21T19:10:00", client: "pardus-pc-010", policy: "Paket Güncellik Politikası", result: "non_compliant", detail: "15 adet güvenlik güncellemesi beklemede. Son güncelleme: 12 gün önce." },
    { id: 7, timestamp: "2026-02-21T19:05:00", client: "pardus-pc-006", policy: "Parola Politikası", result: "non_compliant", detail: "PAM konfigürasyonunda minimum karakter sayısı 8 olarak ayarlı. Beklenen: 12" },
    { id: 8, timestamp: "2026-02-21T19:00:00", client: "pardus-pc-004", policy: "Disk Şifreleme Politikası", result: "compliant", detail: "LUKS şifreleme aktif. /dev/sda2 şifreli bölüm." },
    { id: 9, timestamp: "2026-02-21T18:55:00", client: "pardus-pc-003", policy: "Firewall Politikası", result: "non_compliant", detail: "UFW devre dışı. Tüm portlar açık durumda." },
    { id: 10, timestamp: "2026-02-21T18:50:00", client: "pardus-pc-007", policy: "Log Yönetimi Politikası", result: "compliant", detail: "rsyslog aktif. Merkezi log sunucusu: 192.168.1.100:514" },
    { id: 11, timestamp: "2026-02-21T18:45:00", client: "pardus-pc-006", policy: "NTP Senkronizasyonu", result: "non_compliant", detail: "chrony servisi yüklü değil. Sistem saati 3 dakika geride." },
    { id: 12, timestamp: "2026-02-21T18:40:00", client: "pardus-pc-011", policy: "SSH Güvenlik Politikası", result: "compliant", detail: "Root SSH girişi kapalı. Anahtar tabanlı kimlik doğrulama aktif." },
];

class ComplianceService {

    constructor(axios) {
        this.axios = axios;
    }

    async getComplianceSummary() {
        if (USE_MOCK_DATA) {
            return { response: { data: mockSummary, status: 200 } };
        }
        try {
            const response = await axios.get(complianceSummaryUrl);
            return { response };
        } catch (error) {
            return { error: error };
        }
    }

    async getClientList() {
        if (USE_MOCK_DATA) {
            return { response: { data: mockClients, status: 200 } };
        }
        try {
            const response = await axios.get(complianceClientsUrl);
            return { response };
        } catch (error) {
            return { error: error };
        }
    }

    async getPolicyResults() {
        if (USE_MOCK_DATA) {
            return { response: { data: mockPolicyResults, status: 200 } };
        }
        try {
            const response = await axios.get(compliancePolicyResultsUrl);
            return { response };
        } catch (error) {
            return { error: error };
        }
    }

    async getEvidenceLogs() {
        if (USE_MOCK_DATA) {
            return { response: { data: mockEvidenceLogs, status: 200 } };
        }
        try {
            const response = await axios.get(complianceEvidenceLogsUrl);
            return { response };
        } catch (error) {
            return { error: error };
        }
    }

    async deployPlugin(params) {
        if (USE_MOCK_DATA) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ response: { data: { success: true, message: "Plugin dağıtımı başlatıldı", deployedCount: 5 }, status: 200 } });
                }, 1500);
            });
        }
        try {
            const response = await axios.post(complianceDeployUrl, params);
            return { response };
        } catch (error) {
            return { error: error };
        }
    }
}

export const complianceService = new ComplianceService(axios);
