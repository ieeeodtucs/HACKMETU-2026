<template>
    <div>
        <TabView>
            <TabPanel>
                <template #header>
                    <i class="pi pi-chart-bar"></i>
                    <span>&nbsp;{{ $t('compliance.overview_tab') }}</span>
                </template>
                <compliance-overview></compliance-overview>
            </TabPanel>
            <TabPanel>
                <template #header>
                    <i class="pi pi-desktop"></i>
                    <span>&nbsp;{{ $t('compliance.client_status_tab') }}</span>
                </template>
                <compliance-client-status></compliance-client-status>
            </TabPanel>
            <TabPanel>
                <template #header>
                    <i class="pi pi-check-circle"></i>
                    <span>&nbsp;{{ $t('compliance.policy_results_tab') }}</span>
                </template>
                <compliance-policy-results></compliance-policy-results>
            </TabPanel>
            <TabPanel>
                <template #header>
                    <i class="pi pi-file"></i>
                    <span>&nbsp;{{ $t('compliance.evidence_log_tab') }}</span>
                </template>
                <compliance-evidence-log></compliance-evidence-log>
            </TabPanel>
        </TabView>
    </div>
</template>

<script>
import ComplianceOverview from "./Tabs/ComplianceOverview.vue";
import ComplianceClientStatus from "./Tabs/ComplianceClientStatus.vue";
import CompliancePolicyResults from "./Tabs/CompliancePolicyResults.vue";
import ComplianceEvidenceLog from "./Tabs/ComplianceEvidenceLog.vue";

export default {
    components: {
        ComplianceOverview,
        ComplianceClientStatus,
        CompliancePolicyResults,
        ComplianceEvidenceLog
    }
}
</script>

<style lang="scss" scoped>
</style>
