<template>
    <div class="compliance-policy-results">
        <div class="p-d-flex p-jc-between p-ai-center p-mb-3">
            <h3 style="margin:0">{{ $t('compliance.policy_results_title') }}</h3>
            <Dropdown v-model="severityFilter" :options="severityOptions" optionLabel="label" optionValue="value"
                :placeholder="$t('compliance.filter_by_severity')" :showClear="true" style="width: 200px" />
        </div>

        <DataTable :value="filteredPolicies" :loading="loading" responsiveLayout="scroll"
            class="p-datatable-sm" :rowHover="true">

            <Column field="policyName" :header="$t('compliance.policy_name')" :sortable="true" style="min-width: 200px">
                <template #body="slotProps">
                    <div>
                        <strong>{{ slotProps.data.policyName }}</strong>
                        <br/>
                        <small style="color: #777">{{ slotProps.data.description }}</small>
                    </div>
                </template>
            </Column>
            <Column field="active" :header="$t('compliance.policy_active')" :sortable="true" style="width: 100px; text-align:center">
                <template #body="slotProps">
                    <Tag :severity="slotProps.data.active ? 'success' : 'danger'"
                         :value="slotProps.data.active ? $t('compliance.active') : $t('compliance.inactive')" />
                </template>
            </Column>
            <Column field="severity" :header="$t('compliance.severity')" :sortable="true" style="width: 120px">
                <template #body="slotProps">
                    <Tag :severity="getSeverityColor(slotProps.data.severity)"
                         :value="getSeverityLabel(slotProps.data.severity)" />
                </template>
            </Column>
            <Column field="category" :header="$t('compliance.category')" :sortable="true" style="width: 130px">
                <template #body="slotProps">
                    <span class="category-badge">{{ getCategoryLabel(slotProps.data.category) }}</span>
                </template>
            </Column>
            <Column field="totalChecked" :header="$t('compliance.checked')" :sortable="true" style="width: 100px; text-align:center">
                <template #body="slotProps">
                    <span style="font-weight:bold">{{ slotProps.data.totalChecked }}</span>
                </template>
            </Column>
            <Column field="compliant" :header="$t('compliance.compliant')" :sortable="true" style="width: 100px; text-align:center">
                <template #body="slotProps">
                    <span style="color: #4CAF50; font-weight: bold">{{ slotProps.data.compliant }}</span>
                </template>
            </Column>
            <Column field="nonCompliant" :header="$t('compliance.non_compliant')" :sortable="true" style="width: 110px; text-align:center">
                <template #body="slotProps">
                    <span style="color: #F44336; font-weight: bold">{{ slotProps.data.nonCompliant }}</span>
                </template>
            </Column>
            <Column field="complianceRate" :header="$t('compliance.compliance_rate')" :sortable="true" style="width: 160px">
                <template #body="slotProps">
                    <div class="rate-cell">
                        <ProgressBar :value="slotProps.data.complianceRate" :showValue="false"
                            style="height: 0.8rem; flex: 1"
                            :class="getRateClass(slotProps.data.complianceRate)" />
                        <span class="rate-text">%{{ slotProps.data.complianceRate }}</span>
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
            policies: [],
            loading: false,
            severityFilter: null,
            severityOptions: [
                { label: this.$t('compliance.severity_critical'), value: 'critical' },
                { label: this.$t('compliance.severity_high'), value: 'high' },
                { label: this.$t('compliance.severity_medium'), value: 'medium' },
                { label: this.$t('compliance.severity_low'), value: 'low' }
            ]
        };
    },

    computed: {
        filteredPolicies() {
            if (!this.severityFilter) return this.policies;
            return this.policies.filter(p => p.severity === this.severityFilter);
        }
    },

    mounted() {
        this.loadPolicies();
    },

    methods: {
        async loadPolicies() {
            this.loading = true;
            const { response, error } = await complianceService.getPolicyResults();
            this.loading = false;
            if (error) {
                this.$toast.add({ severity: 'error', summary: this.$t('compliance.error'), detail: this.$t('compliance.load_error'), life: 3000 });
                return;
            }
            this.policies = response.data;
        },

        getSeverityColor(severity) {
            const map = { critical: 'danger', high: 'warning', medium: 'info', low: 'success' };
            return map[severity] || 'info';
        },

        getSeverityLabel(severity) {
            const map = {
                critical: this.$t('compliance.severity_critical'),
                high: this.$t('compliance.severity_high'),
                medium: this.$t('compliance.severity_medium'),
                low: this.$t('compliance.severity_low')
            };
            return map[severity] || severity;
        },

        getCategoryLabel(category) {
            const map = {
                security: this.$t('compliance.cat_security'),
                authentication: this.$t('compliance.cat_authentication'),
                device: this.$t('compliance.cat_device'),
                configuration: this.$t('compliance.cat_configuration'),
                update: this.$t('compliance.cat_update'),
                monitoring: this.$t('compliance.cat_monitoring')
            };
            return map[category] || category;
        },

        getRateClass(rate) {
            if (rate >= 90) return 'rate-high';
            if (rate >= 70) return 'rate-medium';
            return 'rate-low';
        }
    }
}
</script>

<style lang="scss" scoped>
.compliance-policy-results {
    padding: 1rem;

    .category-badge {
        background: #E3F2FD;
        color: #1565C0;
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 500;
    }

    .rate-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        .rate-text {
            font-size: 0.85rem;
            font-weight: bold;
            min-width: 45px;
        }
    }

    ::v-deep .rate-high .p-progressbar-value {
        background: #4CAF50;
    }
    ::v-deep .rate-medium .p-progressbar-value {
        background: #FF9800;
    }
    ::v-deep .rate-low .p-progressbar-value {
        background: #F44336;
    }
}
</style>
