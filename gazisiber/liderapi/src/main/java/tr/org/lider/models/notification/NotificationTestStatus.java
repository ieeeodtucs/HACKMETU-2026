package tr.org.lider.models.notification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum NotificationTestStatus {
    IDLE("idle"),
    SUCCESS("success"),
    FAILED("failed");

    private final String value;

    NotificationTestStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static NotificationTestStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (NotificationTestStatus candidate : NotificationTestStatus.values()) {
            if (candidate.value.equalsIgnoreCase(value)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("No matching NotificationTestStatus for value: " + value);
    }
}
