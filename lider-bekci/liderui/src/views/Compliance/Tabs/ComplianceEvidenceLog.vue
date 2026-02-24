<template>
    <div class="compliance-evidence-log">
        <div class="p-d-flex p-jc-between p-ai-center p-mb-3">
            <h3 style="margin:0">{{ $t('compliance.evidence_log_title') }}</h3>
            <div class="p-d-flex p-ai-center" style="gap: 0.5rem">
                <Dropdown v-model="resultFilter" :options="resultOptions" optionLabel="label" optionValue="value"
                    :placeholder="$t('compliance.filter_by_result')" :showClear="true" style="width: 180px" />
                <span class="p-input-icon-left">
                    <i class="pi pi-search" />
                    <InputText v-model="searchText" :placeholder="$t('compliance.search')" />
                </span>
                <Button icon="pi pi-download" class="p-button-outlined p-button-sm" 
                    :label="$t('compliance.export')" @click="exportData" />
            </div>
        </div>

        <DataTable :value="filteredLogs" :paginator="true" :rows="10" :loading="loading"
            responsiveLayout="scroll"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
            :currentPageReportTemplate="$t('compliance.page_report')"
            sortField="timestamp" :sortOrder="-1"
            class="p-datatable-sm">

            <Column field="timestamp" :header="$t('compliance.timestamp')" :sortable="true" style="width: 170px">
                <template #body="slotProps">
                    {{ formatDate(slotProps.data.timestamp) }}
                </template>
            </Column>
            <Column field="client" :header="$t('compliance.client')" :sortable="true" style="width: 150px">
                <template #body="slotProps">
                    <strong>{{ slotProps.data.client }}</strong>
                </template>
            </Column>
            <Column field="policy" :header="$t('compliance.policy')" :sortable="true" style="min-width: 180px"></Column>
            <Column field="result" :header="$t('compliance.result')" :sortable="true" style="width: 120px">
                <template #body="slotProps">
                    <Tag :severity="slotProps.data.result === 'compliant' ? 'success' : 'danger'"
                         :value="slotProps.data.result === 'compliant' ? $t('compliance.compliant') : $t('compliance.non_compliant')" />
                </template>
            </Column>
            <Column field="detail" :header="$t('compliance.detail')" style="min-width: 300px">
                <template #body="slotProps">
                    <div class="detail-cell">
                        <i :class="slotProps.data.result === 'compliant' ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'"
                           :style="{ color: slotProps.data.result === 'compliant' ? '#4CAF50' : '#F44336', marginRight: '0.4rem' }"></i>
                        <span>{{ slotProps.data.detail }}</span>
                    </div>
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
            logs: [],
            loading: false,
            searchText: '',
            resultFilter: null,
            resultOptions: [
                { label: this.$t('compliance.compliant'), value: 'compliant' },
                { label: this.$t('compliance.non_compliant'), value: 'non_compliant' }
            ]
        };
    },

    computed: {
        filteredLogs() {
            let result = this.logs;
            if (this.resultFilter) {
                result = result.filter(l => l.result === this.resultFilter);
            }
            if (this.searchText) {
                const search = this.searchText.toLowerCase();
                result = result.filter(l =>
                    l.client.toLowerCase().includes(search) ||
                    l.policy.toLowerCase().includes(search) ||
                    l.detail.toLowerCase().includes(search)
                );
            }
            return result;
        }
    },

    mounted() {
        this.loadLogs();
    },

    methods: {
        async loadLogs() {
            this.loading = true;
            const { response, error } = await complianceService.getEvidenceLogs();
            this.loading = false;
            if (error) {
                this.$toast.add({ severity: 'error', summary: this.$t('compliance.error'), detail: this.$t('compliance.load_error'), life: 3000 });
                return;
            }
            this.logs = response.data;
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString(this.$i18n.locale === 'tr' ? 'tr-TR' : 'en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        },

        exportData() {
            // Simple CSV export
            const headers = ['Tarih', 'İstemci', 'Politika', 'Sonuç', 'Detay'];
            const rows = this.filteredLogs.map(l => [
                l.timestamp, l.client, l.policy, l.result, l.detail
            ]);
            let csv = headers.join(',') + '\n';
            rows.forEach(r => {
                csv += r.map(v => '"' + (v || '').replace(/"/g, '""') + '"').join(',') + '\n';
            });
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'compliance_evidence_' + new Date().toISOString().slice(0, 10) + '.csv';
            link.click();
            URL.revokeObjectURL(url);
        }
    }
}
</script>

<style lang="scss" scoped>
.compliance-evidence-log {
    padding: 1rem;

    .detail-cell {
        display: flex;
        align-items: flex-start;
        font-size: 0.85rem;
        line-height: 1.4;
    }
}
</style>
