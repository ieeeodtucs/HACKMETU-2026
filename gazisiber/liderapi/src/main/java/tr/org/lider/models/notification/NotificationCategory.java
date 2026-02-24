package tr.org.lider.models.notification;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum NotificationCategory {
    DIRECTORY("directory"),
    NOTIFICATION("notification"),
    XMPP("xmpp"),
    FILE("file"),
    EMAIL("email"),
    OTHER("other");

    private final String value;

    NotificationCategory(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static NotificationCategory fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (NotificationCategory candidate : NotificationCategory.values()) {
            if (candidate.value.equalsIgnoreCase(value)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("No matching NotificationCategory for value: " + value);
    }
}
