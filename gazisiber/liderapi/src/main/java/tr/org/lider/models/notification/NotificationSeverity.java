package tr.org.lider.models.notification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum NotificationSeverity {
    INFO("info"),
    WARNING("warning"),
    ERROR("error"),
    CRITICAL("critical");

    private final String value;

    NotificationSeverity(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static NotificationSeverity fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (NotificationSeverity candidate : NotificationSeverity.values()) {
            if (candidate.value.equalsIgnoreCase(value)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("No matching NotificationSeverity for value: " + value);
    }
}
