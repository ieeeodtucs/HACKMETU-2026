<template>
    <div class="compliance-client-status">
        <div class="p-d-flex p-jc-between p-ai-center p-mb-3">
            <h3 style="margin:0">{{ $t('compliance.client_list_title') }}</h3>
            <div class="p-d-flex p-ai-center" style="gap: 0.5rem">
                <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value"
                    :placeholder="$t('compliance.filter_by_status')" :showClear="true" style="width: 200px" />
                <span class="p-input-icon-left">
                    <i class="pi pi-search" />
                    <InputText v-model="searchText" :placeholder="$t('compliance.search')" />
                </span>
            </div>
        </div>

        <DataTable :value="filteredClients" :paginator="true" :rows="10" :loading="loading"
            responsiveLayout="scroll"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
            :currentPageReportTemplate="$t('compliance.page_report')"
            :globalFilterFields="['hostname', 'ip', 'os']"
            class="p-datatable-sm">

            <Column field="hostname" :header="$t('compliance.hostname')" :sortable="true">
                <template #body="slotProps">
                    <span>
                        <i :class="slotProps.data.online ? 'pi pi-circle-on' : 'pi pi-circle-off'"
                           :style="{ color: slotProps.data.online ? '#4CAF50' : '#ccc', marginRight: '0.4rem', fontSize: '0.7rem' }"></i>
                        {{ slotProps.data.hostname }}
                    </span>
                </template>
            </Column>
            <Column field="ip" :header="$t('compliance.ip_address')" :sortable="true"></Column>
            <Column field="os" :header="$t('compliance.operating_system')" :sortable="true"></Column>
            <Column field="pluginStatus" :header="$t('compliance.plugin_status')" :sortable="true">
                <template #body="slotProps">
                    <Tag :severity="slotProps.data.pluginStatus === 'installed' ? 'success' : 'danger'"
                         :value="slotProps.data.pluginStatus === 'installed' ? $t('compliance.installed') : $t('compliance.not_installed')" />
                </template>
            </Column>
            <Column field="lastCheck" :header="$t('compliance.last_check')" :sortable="true">
                <template #body="slotProps">
                    {{ formatDate(slotProps.data.lastCheck) }}
                </template>
            </Column>
            <Column field="complianceStatus" :header="$t('compliance.compliance_status')" :sortable="true">
                <template #body="slotProps">
                    <Tag :severity="getStatusSeverity(slotProps.data.complianceStatus)"
                         :value="getStatusLabel(slotProps.data.complianceStatus)" />
                </template>
            </Column>
            <Column field="complianceScore" :header="$t('compliance.score')" :sortable="true">
                <template #body="slotProps">
                    <ProgressBar :value="slotProps.data.complianceScore" :showValue="true"
                        style="height: 1.2rem; width: 80px"
                        :class="getScoreClass(slotProps.data.complianceScore)" />
                </template>
            </Column>
            <Column :header="$t('compliance.violations')">
                <template #body="slotProps">
                    <div v-if="slotProps.data.violations && slotProps.data.violations.length > 0">
                        <ul class="violation-list">
                            <li v-for="(v, idx) in slotProps.data.violations" :key="idx">{{ v }}</li>
                        </ul>
                    </div>
                    <span v-else style="color: #aaa">-</span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<script>
import { complianceService } from '../../../services/Compliance/ComplianceService';

export default {
    data() {
        return {
            clients: [],
            loading: false,
            searchText: '',
            statusFilter: null,
            statusOptions: [
                { label: this.$t('compliance.compliant'), value: 'compliant' },
                { label: this.$t('compliance.non_compliant'), value: 'non_compliant' },
                { label: this.$t('compliance.pending'), value: 'pending' }
            ]
        };
    },

    computed: {
        filteredClients() {
            let result = this.clients;
            if (this.statusFilter) {
                result = result.filter(c => c.complianceStatus === this.statusFilter);
            }
            if (this.searchText) {
                const search = this.searchText.toLowerCase();
                result = result.filter(c =>
                    c.hostname.toLowerCase().includes(search) ||
                    c.ip.toLowerCase().includes(search) ||
                    c.os.toLowerCase().includes(search)
                );
            }
            return result;
        }
    },

    mounted() {
        this.loadClients();
    },

    methods: {
        async loadClients() {
            this.loading = true;
            const { response, error } = await complianceService.getClientList();
            this.loading = false;
            if (error) {
                this.$toast.add({ severity: 'error', summary: this.$t('compliance.error'), detail: this.$t('compliance.load_error'), life: 3000 });
                return;
            }
            this.clients = response.data;
        },

        getStatusSeverity(status) {
            const map = { compliant: 'success', non_compliant: 'danger', pending: 'warning' };
            return map[status] || 'info';
        },

        getStatusLabel(status) {
            const map = {
                compliant: this.$t('compliance.compliant'),
                non_compliant: this.$t('compliance.non_compliant'),
                pending: this.$t('compliance.pending')
            };
            return map[status] || status;
        },

        getScoreClass(score) {
            if (score >= 80) return 'score-high';
            if (score >= 50) return 'score-medium';
            return 'score-low';
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString(this.$i18n.locale === 'tr' ? 'tr-TR' : 'en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }
}
</script>

<style lang="scss" scoped>
.compliance-client-status {
    padding: 1rem;

    .violation-list {
        margin: 0;
        padding-left: 1.2rem;
        li {
            font-size: 0.8rem;
            color: #D32F2F;
        }
    }

    ::v-deep .score-high .p-progressbar-value {
        background: #4CAF50;
    }
    ::v-deep .score-medium .p-progressbar-value {
        background: #FF9800;
    }
    ::v-deep .score-low .p-progressbar-value {
        background: #F44336;
    }
}
</style>
