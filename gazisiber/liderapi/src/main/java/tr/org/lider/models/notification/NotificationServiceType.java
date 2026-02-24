package tr.org.lider.models.notification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum NotificationServiceType {
    EMAIL("email"),
    FCM("fcm"),
    GOOGLECHAT("googlechat"),
    JIRA("jira"),
    MATRIX("matrix"),
    MASTODON("mastodon"),
    MATTERMOST("mattermost"),
    MSTEAMS("msteams"),
    NEXTCLOUDTALK("nextcloudtalk"),
    ROCKETCHAT("rocketchat"),
    SIGNAL("signal"),
    SLACK("slack"),
    SMTP2GO("smtp2go"),
    TELEGRAM("telegram"),
    WHATSAPP("whatsapp"),
    ZULIP("zulip"),
    DISCORD("discord"),
    WEBHOOK("webhook"),
    APPRISE("apprise");

    private final String value;

    NotificationServiceType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static NotificationServiceType fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (NotificationServiceType candidate : NotificationServiceType.values()) {
            if (candidate.value.equalsIgnoreCase(value)) {
                return candidate;
            }
        }
        return null;
    }
}
