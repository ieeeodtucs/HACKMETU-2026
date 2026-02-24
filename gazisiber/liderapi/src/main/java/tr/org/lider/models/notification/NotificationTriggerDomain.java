package tr.org.lider.models.notification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum NotificationTriggerDomain {
    USER("user"),
    AGENT("agent"),
    TASK("task"),
    POLICY("policy"),
    SYSTEM("system");

    private final String value;

    NotificationTriggerDomain(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static NotificationTriggerDomain fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (NotificationTriggerDomain candidate : NotificationTriggerDomain.values()) {
            if (candidate.value.equalsIgnoreCase(value)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("No matching NotificationTriggerDomain for value: " + value);
    }
}

