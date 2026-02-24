<template>
    <div class="compliance-overview">
        <!-- Summary Cards -->
        <div class="p-grid p-mb-4">
            <div class="p-col-12 p-md-6 p-lg-3">
                <Card class="summary-card card-total">
                    <template #content>
                        <div class="card-inner">
                            <i class="pi pi-desktop card-icon"></i>
                            <div class="card-info">
                                <span class="card-value">{{ summary.totalClients }}</span>
                                <span class="card-label">{{ $t('compliance.total_clients') }}</span>
                            </div>
                        </div>
                        <div class="card-sub">
                            <span class="online-dot"></span> {{ summary.onlineClients }} {{ $t('compliance.online') }}
                            &nbsp;|&nbsp;
                            <span class="offline-dot"></span> {{ summary.offlineClients }} {{ $t('compliance.offline') }}
                        </div>
                    </template>
                </Card>
            </div>
            <div class="p-col-12 p-md-6 p-lg-3">
                <Card class="summary-card card-compliant">
                    <template #content>
                        <div class="card-inner">
                            <i class="pi pi-check-circle card-icon" style="color: #4CAF50"></i>
                            <div class="card-info">
                                <span class="card-value" style="color: #4CAF50">{{ summary.compliantClients }}</span>
                                <span class="card-label">{{ $t('compliance.compliant') }}</span>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>
            <div class="p-col-12 p-md-6 p-lg-3">
                <Card class="summary-card card-noncompliant">
                    <template #content>
                        <div class="card-inner">
                            <i class="pi pi-times-circle card-icon" style="color: #F44336"></i>
                            <div class="card-info">
                                <span class="card-value" style="color: #F44336">{{ summary.nonCompliantClients }}</span>
                                <span class="card-label">{{ $t('compliance.non_compliant') }}</span>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>
            <div class="p-col-12 p-md-6 p-lg-3">
                <Card class="summary-card card-pending">
                    <template #content>
                        <div class="card-inner">
                            <i class="pi pi-clock card-icon" style="color: #FF9800"></i>
                            <div class="card-info">
                                <span class="card-value" style="color: #FF9800">{{ summary.pendingClients }}</span>
                                <span class="card-label">{{ $t('compliance.pending') }}</span>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>
        </div>

        <!-- Compliance Rate Chart & Deploy Action -->
        <div class="p-grid p-mb-4">
            <div class="p-col-12 p-md-6 p-lg-4">
                <Card>
                    <template #title>
                        <span style="font-size:1.1rem">{{ $t('compliance.compliance_rate') }}</span>
                    </template>
                    <template #content>
                        <Chart type="doughnut" :data="chartData" :options="chartOptions" :width="300" :height="250" />
                        <div class="rate-text">
                            <span class="rate-value">%{{ summary.complianceRate }}</span>
                            <span class="rate-label">{{ $t('compliance.overall_compliance') }}</span>
                        </div>
                    </template>
                </Card>
            </div>
            <div class="p-col-12 p-md-6 p-lg-4">
                <Card>
                    <template #title>
                        <span style="font-size:1.1rem">{{ $t('compliance.violation_summary') }}</span>
                    </template>
                    <template #content>
                        <div class="violation-stats">
                            <div class="violation-item critical">
                                <i class="pi pi-exclamation-triangle"></i>
                                <div>
                                    <span class="violation-count">{{ summary.criticalViolations }}</span>
                                    <span class="violation-label">{{ $t('compliance.critical_violations') }}</span>
                                </div>
                            </div>
                            <div class="violation-item warning">
                                <i class="pi pi-exclamation-circle"></i>
                                <div>
                                    <span class="violation-count">{{ summary.warningViolations }}</span>
                                    <span class="violation-label">{{ $t('compliance.warning_violations') }}</span>
                                </div>
                            </div>
                            <div class="violation-item drift">
                                <i class="pi pi-replay"></i>
                                <div>
                                    <span class="violation-count">{{ summary.driftDetected }}</span>
                                    <span class="violation-label">{{ $t('compliance.drift_detected') }}</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>
            <div class="p-col-12 p-md-6 p-lg-4">
                <Card>
                    <template #title>
                        <span style="font-size:1.1rem">{{ $t('compliance.plugin_deployment') }}</span>
                    </template>
                    <template #content>
                        <div class="deploy-section">
                            <div class="deploy-info">
                                <p><i class="pi pi-info-circle"></i> {{ $t('compliance.deploy_description') }}</p>
                                <div class="deploy-stats">
                                    <span class="deploy-stat">
                                        <i class="pi pi-check" style="color:#4CAF50"></i>
                                        {{ summary.pluginInstalledClients }} {{ $t('compliance.plugin_installed') }}
                                    </span>
                                    <span class="deploy-stat">
                                        <i class="pi pi-times" style="color:#F44336"></i>
                                        {{ summary.pluginNotInstalledClients }} {{ $t('compliance.plugin_not_installed') }}
                                    </span>
                                </div>
                            </div>

                            <!-- Müşteri Seçimi (MultiSelect) -->
                            <div class="p-field p-mt-3">
                                <label style="font-weight: bold; display: block; margin-bottom: 0.5rem">{{ $t('compliance.select_targets') || 'Hedef İstemcileri Seçin' }}</label>
                                <MultiSelect 
                                    v-model="selectedTargets" 
                                    :options="availableClients" 
                                    optionLabel="hostname" 
                                    optionValue="hostname"
                                    :placeholder="$t('compliance.all_missing_clients') || 'Tümü (Eksik Olanlar)'" 
                                    style="width: 100%"
                                    display="chip"
                                    :filter="true"
                                />
                            </div>

                            <Button 
                                :label="$t('compliance.deploy_plugin_button')" 
                                icon="pi pi-cloud-upload" 
                                class="p-button-success p-button-lg deploy-button p-mt-2"
                                :loading="deploying"
                                @click="deployPluginToClients"
                            />
                            <small v-if="deployMessage" class="deploy-message">
                                <i class="pi pi-check-circle" style="color: #4CAF50"></i> {{ deployMessage }}
                            </small>
                        </div>
                    </template>
                </Card>
            </div>
        </div>

        <!-- Canlı Log Ekranı (Live Logs Dialog) -->
        <Dialog :header="$t('compliance.deployment_logs') || 'Kurulum ve Doğrulama Logları'" v-model:visible="showLogsDialog" :style="{width: '50vw'}" :maximizable="true" :modal="true" @hide="stopPollingLogs">
            <div class="log-console">
                <div v-for="(log, idx) in liveLogs" :key="idx" class="log-line">
                    <span class="log-time">[{{ new Date(log.timestamp).toLocaleTimeString() }}]</span>
                    <span class="log-client" style="color: #4CAF50;">[{{ log.client }}]</span>
                    <span class="log-policy" style="color: #FF9800;">[{{ log.policy }}]</span>
                    <span class="log-detail" :class="{'log-compliant': log.result === 'compliant', 'log-noncompliant': log.result !== 'compliant'}">
                        {{ log.detail }}
                    </span>
                </div>
                <div v-if="liveLogs.length === 0" style="color: #888; text-align: center; padding: 2rem;">
                    {{ $t('compliance.waiting_for_logs') || 'İstemcilerden doğrulama bekleniyor...' }} <i class="pi pi-spin pi-spinner"></i>
                </div>
            </div>
            <template #footer>
                <Button label="Kapat" icon="pi pi-times" @click="showLogsDialog = false" class="p-button-text"/>
            </template>
        </Dialog>

        <!-- Last Scan Info -->
        <div class="p-grid">
            <div class="p-col-12">
                <div class="last-scan-info">
                    <i class="pi pi-clock"></i>
                    {{ $t('compliance.last_scan') }}: {{ formatDate(summary.lastScanDate) }}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { complianceService } from '../../../services/Compliance/ComplianceService';

export default {
    data() {
        return {
            summary: {
                totalClients: 0,
                compliantClients: 0,
                nonCompliantClients: 0,
                pendingClients: 0,
                pluginInstalledClients: 0,
                pluginNotInstalledClients: 0,
                onlineClients: 0,
                offlineClients: 0,
                complianceRate: 0,
                lastScanDate: null,
                criticalViolations: 0,
                warningViolations: 0,
                driftDetected: 0
            },
            deploying: false,
            deployMessage: '',
            availableClients: [],
            selectedTargets: [],
            showLogsDialog: false,
            liveLogs: [],
            pollInterval: null,
            latestLogId: 0,
            chartData: null,
            chartOptions: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                maintainAspectRatio: false
            }
        }
    },

    mounted() {
        this.loadSummary();
        this.loadClients();
    },

    beforeUnmount() {
        this.stopPollingLogs();
    },

    methods: {
        async loadSummary() {
            const { response, error } = await complianceService.getComplianceSummary();
            if (error) {
                this.$toast.add({ severity: 'error', summary: this.$t('compliance.error'), detail: this.$t('compliance.load_error'), life: 3000 });
                return;
            }
            this.summary = response.data;
            this.renderChart();
        },

        async loadClients() {
            const { response } = await complianceService.getClientList();
            if (response && response.data) {
                this.availableClients = response.data;
            }
        },

        renderChart() {
            this.chartData = {
                labels: [
                    this.$t('compliance.compliant'),
                    this.$t('compliance.non_compliant'),
                    this.$t('compliance.pending')
                ],
                datasets: [{
                    data: [this.summary.compliantClients, this.summary.nonCompliantClients, this.summary.pendingClients],
                    backgroundColor: ['#4CAF50', '#F44336', '#FF9800'],
                    hoverBackgroundColor: ['#66BB6A', '#EF5350', '#FFA726']
                }]
            };
        },

        async deployPluginToClients() {
            this.deploying = true;
            this.deployMessage = '';
            
            // Log ekranını hazırla ve aç
            this.liveLogs = [];
            
            // Başlangıç için mevcut en son log ID'sini alalım ki eskiler akmasın
            const { response: logsResp } = await complianceService.getEvidenceLogs();
            if (logsResp && logsResp.data && logsResp.data.length > 0) {
                this.latestLogId = logsResp.data[0].id;
            } else {
                this.latestLogId = 0;
            }

            this.showLogsDialog = true;
            this.startPollingLogs();

            let payload = {};
            if (this.selectedTargets && this.selectedTargets.length > 0) {
                payload = { target_clients: this.selectedTargets };
            }

            const { response, error } = await complianceService.deployPlugin(payload);
            this.deploying = false;
            
            if (error) {
                this.$toast.add({ severity: 'error', summary: this.$t('compliance.error'), detail: this.$t('compliance.deploy_error'), life: 3000 });
                this.stopPollingLogs();
                return;
            }
            
            this.deployMessage = response.data.message + ' (' + response.data.deployedCount + ' ' + this.$t('compliance.clients_lowercase') + ')';
            this.$toast.add({ severity: 'success', summary: this.$t('compliance.success'), detail: response.data.message, life: 3000 });
        },

        startPollingLogs() {
            if (this.pollInterval) return;
            this.pollInterval = setInterval(async () => {
                const { response } = await complianceService.getEvidenceLogs();
                if (response && response.data) {
                    const allLogs = response.data;
                    const newLogs = allLogs.filter(log => log.id > this.latestLogId);
                    
                    if (newLogs.length > 0) {
                        this.latestLogId = newLogs[0].id; // En güncel log
                        this.liveLogs = [...newLogs, ...this.liveLogs].slice(0, 50); // Maksimum 50 göster
                        
                        // YENI LOG GELDIGINDE DASHBOARD METRIKLERINI (Aktif İstemciler vb.) CANLI GUNCELLE
                        this.loadSummary();
                        this.loadClients();
                    }
                }
            }, 2000); // 2 saniyede bir kontrol et
        },

        stopPollingLogs() {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString(this.$i18n.locale === 'tr' ? 'tr-TR' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }
}
</script>

<style lang="scss" scoped>
.compliance-overview {
    padding: 1rem;

    .log-console {
        background-color: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Courier New', Courier, monospace;
        padding: 1rem;
        border-radius: 4px;
        min-height: 300px;
        max-height: 500px;
        overflow-y: auto;
        
        .log-line {
            padding: 0.2rem 0;
            border-bottom: 1px solid #333;
            
            .log-time { color: #569cd6; margin-right: 0.5rem; }
            .log-client { margin-right: 0.5rem; font-weight: bold; }
            .log-policy { margin-right: 0.5rem; }
            .log-compliant { color: #4CAF50; }
            .log-noncompliant { color: #F44336; }
        }
    }

    .summary-card {
        .card-inner {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 0.5rem;
        }
        .card-icon {
            font-size: 2.2rem;
            color: #20639B;
        }
        .card-value {
            font-size: 2rem;
            font-weight: bold;
            display: block;
        }
        .card-label {
            font-size: 0.9rem;
            color: #666;
        }
        .card-sub {
            font-size: 0.85rem;
            color: #888;
            margin-top: 0.3rem;
        }
        .online-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #4CAF50;
            border-radius: 50%;
        }
        .offline-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #F44336;
            border-radius: 50%;
        }
    }

    .rate-text {
        text-align: center;
        margin-top: 0.5rem;
        .rate-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #20639B;
            display: block;
        }
        .rate-label {
            color: #666;
            font-size: 0.9rem;
        }
    }

    .violation-stats {
        .violation-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 0.8rem;

            i {
                font-size: 1.5rem;
            }
            .violation-count {
                font-size: 1.4rem;
                font-weight: bold;
                display: block;
            }
            .violation-label {
                font-size: 0.85rem;
                color: #666;
            }

            &.critical {
                background: #FFEBEE;
                i { color: #D32F2F; }
                .violation-count { color: #D32F2F; }
            }
            &.warning {
                background: #FFF3E0;
                i { color: #F57C00; }
                .violation-count { color: #F57C00; }
            }
            &.drift {
                background: #E3F2FD;
                i { color: #1976D2; }
                .violation-count { color: #1976D2; }
            }
        }
    }

    .deploy-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;

        .deploy-info {
            p {
                color: #555;
                font-size: 0.9rem;
                margin-bottom: 0.8rem;
                i { color: #20639B; margin-right: 0.3rem; }
            }
            .deploy-stats {
                display: flex;
                flex-direction: column;
                gap: 0.4rem;
                .deploy-stat {
                    font-size: 0.9rem;
                    i { margin-right: 0.3rem; }
                }
            }
        }
        .deploy-button {
            width: 100%;
        }
        .deploy-message {
            color: #4CAF50;
            font-size: 0.85rem;
        }
    }

    .last-scan-info {
        text-align: center;
        color: #888;
        font-size: 0.9rem;
        padding: 0.5rem;
        i { margin-right: 0.3rem; }
    }
}
</style>
