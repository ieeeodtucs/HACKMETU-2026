package tr.org.lider.models.notification;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Backend single source for notification trigger and service catalogs.
 */
public final class NotificationCatalogDefaults {

        private static final String L = "settings.server_settings.notification_settings.dialog.";

        private NotificationCatalogDefaults() {
        }

        public static NotificationSettings createDefaultSettings() {
                NotificationSettings settings = new NotificationSettings();
                settings.setVersion(1);
                settings.setChannels(new ArrayList<NotificationChannel>());
                settings.setSavedServiceProfiles(new ArrayList<NotificationServiceConfig>());
                settings.setTriggerCatalog(createDefaultTriggerCatalog());
                settings.setServiceTypeSchemas(createDefaultServiceTypeSchemas());
                settings.setUpdatedAt(null);
                settings.setUpdatedBy(null);
                return settings;
        }

        public static NotificationSettings applyDefaults(NotificationSettings settings) {
                NotificationSettings target = settings == null ? new NotificationSettings() : settings;
                List<NotificationTrigger> defaultTriggers = createDefaultTriggerCatalog();
                List<ServiceTypeSchema> defaultServiceSchemas = createDefaultServiceTypeSchemas();

                if (target.getVersion() == null) {
                        target.setVersion(1);
                }
                if (target.getChannels() == null) {
                        target.setChannels(new ArrayList<NotificationChannel>());
                }
                if (target.getSavedServiceProfiles() == null) {
                        target.setSavedServiceProfiles(new ArrayList<NotificationServiceConfig>());
                }
                if (target.getTriggerCatalog() == null || target.getTriggerCatalog().isEmpty()) {
                        target.setTriggerCatalog(copyTriggerList(defaultTriggers));
                } else {
                        target.setTriggerCatalog(mergeTriggerCatalog(target.getTriggerCatalog(), defaultTriggers));
                }
                if (target.getServiceTypeSchemas() == null || target.getServiceTypeSchemas().isEmpty()) {
                        target.setServiceTypeSchemas(copyServiceSchemaList(defaultServiceSchemas));
                } else {
                        target.setServiceTypeSchemas(
                                        mergeServiceSchemas(target.getServiceTypeSchemas(), defaultServiceSchemas));
                }

                return target;
        }

        public static List<NotificationTrigger> createDefaultTriggerCatalog() {
                List<NotificationTrigger> triggers = new ArrayList<NotificationTrigger>();

                // ── TASK domain ──────────────────────────────────────────────────────────
                triggers.add(createTrigger(
                                "task.executed",
                                "settings.server_settings.notification_settings.trigger_labels.task_executed",
                                NotificationTriggerDomain.TASK,
                                NotificationSeverity.INFO,
                                true,
                                true));
                triggers.add(createTrigger(
                                "task.failed",
                                "settings.server_settings.notification_settings.trigger_labels.task_failed",
                                NotificationTriggerDomain.TASK,
                                NotificationSeverity.ERROR,
                                false,
                                true));
                triggers.add(createTrigger(
                                "task.completed",
                                "settings.server_settings.notification_settings.trigger_labels.task_completed",
                                NotificationTriggerDomain.TASK,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "task.scheduled.created",
                                "settings.server_settings.notification_settings.trigger_labels.task_scheduled_created",
                                NotificationTriggerDomain.TASK,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "task.scheduled.updated",
                                "settings.server_settings.notification_settings.trigger_labels.task_scheduled_updated",
                                NotificationTriggerDomain.TASK,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "task.scheduled.cancelled",
                                "settings.server_settings.notification_settings.trigger_labels.task_scheduled_cancelled",
                                NotificationTriggerDomain.TASK,
                                NotificationSeverity.WARNING,
                                false,
                                true));

                // ── POLICY domain ─────────────────────────────────────────────────────────
                triggers.add(createTrigger(
                                "policy.applied",
                                "settings.server_settings.notification_settings.trigger_labels.policy_applied",
                                NotificationTriggerDomain.POLICY,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "policy.unassigned",
                                "settings.server_settings.notification_settings.trigger_labels.policy_unassigned",
                                NotificationTriggerDomain.POLICY,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "policy.exception.created",
                                "settings.server_settings.notification_settings.trigger_labels.policy_exception_created",
                                NotificationTriggerDomain.POLICY,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "policy.exception.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.policy_exception_deleted",
                                NotificationTriggerDomain.POLICY,
                                NotificationSeverity.WARNING,
                                false,
                                true));

                // ── AGENT domain ──────────────────────────────────────────────────────────
                triggers.add(createTrigger(
                                "agent.registered",
                                "settings.server_settings.notification_settings.trigger_labels.agent_registered",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                true,
                                true));
                triggers.add(createTrigger(
                                "agent.unregistered",
                                "settings.server_settings.notification_settings.trigger_labels.agent_unregistered",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.online",
                                "settings.server_settings.notification_settings.trigger_labels.agent_online",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.offline",
                                "settings.server_settings.notification_settings.trigger_labels.agent_offline",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.ou.created",
                                "settings.server_settings.notification_settings.trigger_labels.agent_ou_created",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.ou.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.agent_ou_deleted",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.group.created",
                                "settings.server_settings.notification_settings.trigger_labels.agent_group_created",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.group.updated",
                                "settings.server_settings.notification_settings.trigger_labels.agent_group_updated",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.group.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.agent_group_deleted",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "agent.group.moved",
                                "settings.server_settings.notification_settings.trigger_labels.agent_group_moved",
                                NotificationTriggerDomain.AGENT,
                                NotificationSeverity.INFO,
                                false,
                                true));

                // ── USER domain ───────────────────────────────────────────────────────────
                triggers.add(createTrigger(
                                "user.login.failed",
                                "settings.server_settings.notification_settings.trigger_labels.user_login_failed",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.created",
                                "settings.server_settings.notification_settings.trigger_labels.user_created",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                true,
                                true));
                triggers.add(createTrigger(
                                "user.updated",
                                "settings.server_settings.notification_settings.trigger_labels.user_updated",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.user_deleted",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.moved",
                                "settings.server_settings.notification_settings.trigger_labels.user_moved",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.password.changed",
                                "settings.server_settings.notification_settings.trigger_labels.user_password_changed",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.password.forgot",
                                "settings.server_settings.notification_settings.trigger_labels.user_password_forgot",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.login",
                                "settings.server_settings.notification_settings.trigger_labels.user_login",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                true,
                                true));
                triggers.add(createTrigger(
                                "user.logout",
                                "settings.server_settings.notification_settings.trigger_labels.user_logout",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                true,
                                true));
                triggers.add(createTrigger(
                                "user.session.login",
                                "settings.server_settings.notification_settings.trigger_labels.user_session_login",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.session.logout",
                                "settings.server_settings.notification_settings.trigger_labels.user_session_logout",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.group.created",
                                "settings.server_settings.notification_settings.trigger_labels.user_group_created",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.group.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.user_group_deleted",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.group.moved",
                                "settings.server_settings.notification_settings.trigger_labels.user_group_moved",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.ad.created",
                                "settings.server_settings.notification_settings.trigger_labels.user_ad_created",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.ad.updated",
                                "settings.server_settings.notification_settings.trigger_labels.user_ad_updated",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.ad.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.user_ad_deleted",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "user.ad.password.changed",
                                "settings.server_settings.notification_settings.trigger_labels.user_ad_password_changed",
                                NotificationTriggerDomain.USER,
                                NotificationSeverity.WARNING,
                                false,
                                true));

                // ── SYSTEM domain ─────────────────────────────────────────────────────────
                triggers.add(createTrigger(
                                "system.lider_user.password.changed",
                                "settings.server_settings.notification_settings.trigger_labels.system_lider_user_password_changed",
                                NotificationTriggerDomain.SYSTEM,
                                NotificationSeverity.WARNING,
                                false,
                                true));
                triggers.add(createTrigger(
                                "system.lider_user.updated",
                                "settings.server_settings.notification_settings.trigger_labels.system_lider_user_updated",
                                NotificationTriggerDomain.SYSTEM,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "system.server.created",
                                "settings.server_settings.notification_settings.trigger_labels.system_server_created",
                                NotificationTriggerDomain.SYSTEM,
                                NotificationSeverity.INFO,
                                false,
                                true));
                triggers.add(createTrigger(
                                "system.server.deleted",
                                "settings.server_settings.notification_settings.trigger_labels.system_server_deleted",
                                NotificationTriggerDomain.SYSTEM,
                                NotificationSeverity.WARNING,
                                false,
                                true));

                return triggers;
        }

        // ── Service type schemas ────────────────────────────────────────────

        public static List<ServiceTypeSchema> createDefaultServiceTypeSchemas() {
                List<ServiceTypeSchema> schemas = new ArrayList<ServiceTypeSchema>();

                // ── Email ───────────────────────────────────────────────────────
                // mailto://{user}:{pass}@{domain}?smtp={smtp}&from={from}&to={to1},{to2}
                schemas.add(schema(NotificationServiceType.EMAIL, L + "service_types.email", Arrays.asList(
                                field("user", L + "email_user", "text", true, false, false, "myuser"),
                                field("password", L + "email_password", "password", true, true, false, ""),
                                field("domain", L + "email_domain", "text", true, false, false, "gmail.com"),
                                field("smtp", L + "email_smtp", "text", false, false, false, "smtp.gmail.com"),
                                field("port", L + "email_port", "text", false, false, false, "587"),
                                field("from", L + "email_from", "text", false, false, false, "noreply@example.com"),
                                field("to", L + "email_to", "text", true, false, true, "recipient@example.com"),
                                field("cc", L + "email_cc", "text", false, false, true, ""),
                                field("bcc", L + "email_bcc", "text", false, false, true, ""))));

                // ── FCM ─────────────────────────────────────────────────────────
                // fcm://{APIKey}/{Device1}/{Device2}/{DeviceN}
                schemas.add(schema(NotificationServiceType.FCM, L + "service_types.fcm", Arrays.asList(
                                field("apiKey", L + "fcm_api_key", "password", true, true, false, ""),
                                field("devices", L + "fcm_device", "text", true, false, true, "device-id"))));

                // ── Google Chat ─────────────────────────────────────────────────
                // gchat://{workspace}/{webhook_key}/{webhook_token}
                schemas.add(schema(NotificationServiceType.GOOGLECHAT, L + "service_types.googlechat", Arrays.asList(
                                field("workspace", L + "gchat_workspace", "text", true, false, false, ""),
                                field("webhookKey", L + "gchat_webhook_key", "password", true, true, false, ""),
                                field("webhookToken", L + "gchat_webhook_token", "password", true, true, false, ""))));

                // ── Jira ────────────────────────────────────────────────────────
                // jira://{apikey}/@{user} jira://{apikey}/*{schedule}
                // jira://{apikey}/^{escalation} jira://{apikey}/#{team}
                schemas.add(schema(NotificationServiceType.JIRA, L + "service_types.jira", Arrays.asList(
                                field("apiKey", L + "jira_api_key", "password", true, true, false, ""),
                                field("targets", L + "jira_target", "text", false, false, true,
                                                "@user or #team or *schedule"))));

                // ── Matrix ──────────────────────────────────────────────────────
                // matrix://{user}:{password}@{hostname}/#{room_alias}
                schemas.add(schema(NotificationServiceType.MATRIX, L + "service_types.matrix", Arrays.asList(
                                field("user", L + "matrix_user", "text", true, false, false, ""),
                                field("password", L + "matrix_password", "password", true, true, false, ""),
                                field("hostname", L + "host_name", "text", true, false, false, "matrix.org"),
                                field("roomAlias", L + "matrix_room_alias", "text", true, false, false, "#general"))));

                // ── Mastodon ────────────────────────────────────────────────────
                // mastodon://{token}@{host}/{target1}/{target2}
                schemas.add(schema(NotificationServiceType.MASTODON, L + "service_types.mastodon", Arrays.asList(
                                field("token", L + "mastodon_token", "password", true, true, false, ""),
                                field("host", L + "host_name", "text", true, false, false, "mastodon.social"),
                                field("targets", L + "mastodon_target", "text", false, false, true,
                                                "@user@instance"))));

                // ── Mattermost ──────────────────────────────────────────────────
                // mmost://{botname}@{hostname}:{port}/{token}
                schemas.add(schema(NotificationServiceType.MATTERMOST, L + "service_types.mattermost", Arrays.asList(
                                field("hostname", L + "host_name", "text", true, false, false,
                                                "mattermost.example.com"),
                                field("token", L + "mattermost_token", "password", true, true, false, ""),
                                field("botname", L + "mattermost_botname", "text", false, false, false, ""),
                                field("port", L + "port", "text", false, false, false, ""),
                                field("channel", L + "channel", "text", false, false, false, ""))));

                // ── Microsoft Teams ─────────────────────────────────────────────
                // msteams://{team}/{tokenA}/{tokenB}/{tokenC}
                schemas.add(schema(NotificationServiceType.MSTEAMS, L + "service_types.msteams", Arrays.asList(
                                field("team", L + "msteams_team", "text", true, false, false, ""),
                                field("tokenA", L + "msteams_token_a", "password", true, true, false, ""),
                                field("tokenB", L + "msteams_token_b", "password", true, true, false, ""),
                                field("tokenC", L + "msteams_token_c", "password", true, true, false, ""))));

                // ── Nextcloud Talk ──────────────────────────────────────────────
                // nctalk://{user}:{password}@{hostname}/{room_id}
                schemas.add(schema(NotificationServiceType.NEXTCLOUDTALK, L + "service_types.nextcloudtalk",
                                Arrays.asList(
                                                field("user", L + "nctalk_user", "text", true, false, false, ""),
                                                field("password", L + "nctalk_password", "password", true, true, false,
                                                                ""),
                                                field("hostname", L + "host_name", "text", true, false, false,
                                                                "cloud.example.com"),
                                                field("port", L + "port", "text", false, false, false, ""),
                                                field("roomId", L + "nctalk_room_id", "text", true, false, false,
                                                                ""))));

                // ── Rocket.Chat ─────────────────────────────────────────────────
                // rocket://{user}:{password}@{hostname}/#{channel}
                // rocket://{webhook}@{hostname}/#{channel}
                schemas.add(schema(NotificationServiceType.ROCKETCHAT, L + "service_types.rocketchat", Arrays.asList(
                                field("hostname", L + "host_name", "text", true, false, false, "rocket.example.com"),
                                field("user", L + "rocketchat_user", "text", false, false, false, ""),
                                field("password", L + "rocketchat_password", "password", false, true, false, ""),
                                field("webhook", L + "rocketchat_webhook", "password", false, true, false, ""),
                                field("targets", L + "rocketchat_target", "text", true, false, true,
                                                "#general or @user"))));

                // ── Signal API ──────────────────────────────────────────────────
                // signal://{user}:{password}@{hostname}/{from_phone}/{target}
                schemas.add(schema(NotificationServiceType.SIGNAL, L + "service_types.signal", Arrays.asList(
                                field("user", L + "signal_user", "text", true, false, false, ""),
                                field("password", L + "signal_password", "password", true, true, false, ""),
                                field("hostname", L + "host_name", "text", true, false, false, ""),
                                field("fromPhone", L + "signal_from_phone", "text", true, false, false, "+1234567890"),
                                field("targets", L + "signal_target", "text", false, false, true, "+1234567890"))));

                // ── Slack ───────────────────────────────────────────────────────
                // slack://{tokenA}/{tokenB}/{tokenC}
                schemas.add(schema(NotificationServiceType.SLACK, L + "service_types.slack", Arrays.asList(
                                field("tokenA", L + "slack_token_a", "password", true, true, false, "T00000000"),
                                field("tokenB", L + "slack_token_b", "password", true, true, false, "B00000000"),
                                field("tokenC", L + "slack_token_c", "password", true, true, false, "XXXXXXXX"))));

                // ── SMTP2Go ─────────────────────────────────────────────────────
                // smtp2go://{user}@{domain}/{apikey}/{email1}/{email2}
                schemas.add(schema(NotificationServiceType.SMTP2GO, L + "service_types.smtp2go", Arrays.asList(
                                field("user", L + "smtp2go_user", "text", true, false, false, "sender"),
                                field("domain", L + "smtp2go_domain", "text", true, false, false, "example.com"),
                                field("apiKey", L + "smtp2go_apikey", "password", true, true, false, ""),
                                field("to", L + "smtp2go_to", "text", true, false, true, "recipient@example.com"))));

                // ── Telegram ────────────────────────────────────────────────────
                // tgram://{bot_token}/{chat_id1}/{chat_id2}
                schemas.add(schema(NotificationServiceType.TELEGRAM, L + "service_types.telegram", Arrays.asList(
                                field("botToken", L + "telegram_bot_token", "password", true, true, false, ""),
                                field("chatIds", L + "telegram_chat_id", "text", true, false, true, "123456789"))));

                // ── WhatsApp ────────────────────────────────────────────────────
                // whatsapp://{token}@{from_phone_id}/{targets}
                schemas.add(schema(NotificationServiceType.WHATSAPP, L + "service_types.whatsapp", Arrays.asList(
                                field("token", L + "whatsapp_token", "password", true, true, false, ""),
                                field("fromPhoneId", L + "whatsapp_from_phone", "text", true, false, false, ""),
                                field("targets", L + "whatsapp_target", "text", true, false, true, "+1234567890"))));

                // ── Zulip ───────────────────────────────────────────────────────
                // zulip://{botname}@{organization}/{token}/{stream_or_email}
                schemas.add(schema(NotificationServiceType.ZULIP, L + "service_types.zulip", Arrays.asList(
                                field("botname", L + "zulip_botname", "text", true, false, false, ""),
                                field("organization", L + "zulip_organization", "text", true, false, false, ""),
                                field("token", L + "zulip_token", "password", true, true, false, ""),
                                field("targets", L + "zulip_target", "text", false, false, true,
                                                "#stream or user@example.com"))));

                // ── Discord ─────────────────────────────────────────────────────
                // discord://{WebhookID}/{WebhookToken}
                schemas.add(schema(NotificationServiceType.DISCORD, L + "service_types.discord", Arrays.asList(
                                field("webhookId", L + "discord_webhook_id", "text", true, false, false, ""),
                                field("webhookToken", L + "discord_webhook_token", "password", true, true, false,
                                                ""))));

                // ── Webhook (generic HTTP) ──────────────────────────────────────
                schemas.add(schema(NotificationServiceType.WEBHOOK, L + "service_types.webhook", Arrays.asList(
                                field("url", L + "webhook_url", "text", true, false, false,
                                                "https://example.com/webhook"))));

                // ── Generic Apprise URL ─────────────────────────────────────────
                schemas.add(schema(NotificationServiceType.APPRISE, L + "service_types.apprise", Arrays.asList(
                                field("url", L + "apprise_url", "text", true, false, false,
                                                "tgram://bot_token/chat_id"))));

                return schemas;
        }

        // ── Factory helpers ─────────────────────────────────────────────────

        private static ServiceFieldSchema field(String key, String labelKey, String inputType,
                        boolean required, boolean secret, boolean repeatable, String placeholder) {
                ServiceFieldSchema f = new ServiceFieldSchema();
                f.setKey(key);
                f.setLabelKey(labelKey);
                f.setInputType(inputType);
                f.setRequired(required);
                f.setSecret(secret);
                f.setRepeatable(repeatable);
                f.setPlaceholder(placeholder);
                return f;
        }

        private static NotificationTrigger createTrigger(String id, String labelKey,
                        NotificationTriggerDomain domain, NotificationSeverity severity,
                        boolean defaultEnabled, boolean isSystem) {
                NotificationTrigger trigger = new NotificationTrigger();
                trigger.setId(id);
                trigger.setLabelKey(labelKey);
                trigger.setDomain(domain);
                trigger.setSeverity(severity);
                trigger.setDefaultEnabled(defaultEnabled);
                trigger.setIsSystem(isSystem);
                return trigger;
        }

        private static ServiceTypeSchema schema(NotificationServiceType type,
                        String labelKey, List<ServiceFieldSchema> fields) {
                ServiceTypeSchema s = new ServiceTypeSchema();
                s.setType(type);
                s.setLabelKey(labelKey);
                s.setFields(fields);
                return s;
        }

        // ── Merge / copy utils ──────────────────────────────────────────────

        private static List<NotificationTrigger> mergeTriggerCatalog(
                        List<NotificationTrigger> existing, List<NotificationTrigger> defaults) {
                List<NotificationTrigger> merged = new ArrayList<NotificationTrigger>(
                                existing == null ? new ArrayList<NotificationTrigger>() : existing);
                Set<String> existingIds = new HashSet<String>();
                for (NotificationTrigger trigger : merged) {
                        if (trigger != null && trigger.getId() != null && !trigger.getId().isEmpty()) {
                                existingIds.add(trigger.getId());
                        }
                }
                for (NotificationTrigger defaultTrigger : defaults) {
                        if (!existingIds.contains(defaultTrigger.getId())) {
                                merged.add(copyTrigger(defaultTrigger));
                        }
                }
                return merged;
        }

        private static List<ServiceTypeSchema> mergeServiceSchemas(
                        List<ServiceTypeSchema> existing, List<ServiceTypeSchema> defaults) {
                List<ServiceTypeSchema> merged = new ArrayList<ServiceTypeSchema>();
                Set<NotificationServiceType> consumedTypes = new HashSet<NotificationServiceType>();

                for (ServiceTypeSchema defaultSchema : defaults) {
                        ServiceTypeSchema copy = copyServiceSchema(defaultSchema);
                        merged.add(copy);
                        consumedTypes.add(defaultSchema.getType());
                }

                for (ServiceTypeSchema existingSchema : existing) {
                        if (existingSchema == null || existingSchema.getType() == null) {
                                continue;
                        }
                        if (!consumedTypes.contains(existingSchema.getType())) {
                                merged.add(existingSchema);
                        }
                }
                return merged;
        }

        private static ServiceTypeSchema findByType(List<ServiceTypeSchema> schemas, NotificationServiceType type) {
                if (schemas == null || type == null)
                        return null;
                for (ServiceTypeSchema s : schemas) {
                        if (s != null && type.equals(s.getType()))
                                return s;
                }
                return null;
        }

        private static List<NotificationTrigger> copyTriggerList(List<NotificationTrigger> source) {
                List<NotificationTrigger> copy = new ArrayList<NotificationTrigger>();
                if (source == null)
                        return copy;
                for (NotificationTrigger t : source)
                        copy.add(copyTrigger(t));
                return copy;
        }

        private static NotificationTrigger copyTrigger(NotificationTrigger s) {
                NotificationTrigger c = new NotificationTrigger();
                if (s == null)
                        return c;
                c.setId(s.getId());
                c.setLabelKey(s.getLabelKey());
                c.setDomain(s.getDomain());
                c.setSeverity(s.getSeverity());
                c.setDefaultEnabled(s.getDefaultEnabled());
                c.setIsSystem(s.getIsSystem());
                return c;
        }

        private static List<ServiceTypeSchema> copyServiceSchemaList(List<ServiceTypeSchema> source) {
                List<ServiceTypeSchema> copy = new ArrayList<ServiceTypeSchema>();
                if (source == null)
                        return copy;
                for (ServiceTypeSchema s : source)
                        copy.add(copyServiceSchema(s));
                return copy;
        }

        private static ServiceTypeSchema copyServiceSchema(ServiceTypeSchema s) {
                ServiceTypeSchema c = new ServiceTypeSchema();
                if (s == null)
                        return c;
                c.setType(s.getType());
                c.setLabelKey(s.getLabelKey());
                c.setFields(copyFieldList(s.getFields()));
                return c;
        }

        private static List<ServiceFieldSchema> copyFieldList(List<ServiceFieldSchema> source) {
                List<ServiceFieldSchema> copy = new ArrayList<ServiceFieldSchema>();
                if (source == null)
                        return copy;
                for (ServiceFieldSchema f : source)
                        copy.add(copyField(f));
                return copy;
        }

        private static ServiceFieldSchema copyField(ServiceFieldSchema s) {
                ServiceFieldSchema c = new ServiceFieldSchema();
                if (s == null)
                        return c;
                c.setKey(s.getKey());
                c.setLabelKey(s.getLabelKey());
                c.setInputType(s.getInputType());
                c.setRequired(s.getRequired());
                c.setSecret(s.getSecret());
                c.setRepeatable(s.getRepeatable());
                c.setPlaceholder(s.getPlaceholder());
                return c;
        }
}
