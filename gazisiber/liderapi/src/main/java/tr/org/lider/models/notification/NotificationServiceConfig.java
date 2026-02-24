package tr.org.lider.models.notification;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationServiceConfig implements Serializable {

    private static final long serialVersionUID = 5033546922176627103L;

    private String id = "";
    private NotificationServiceType type = NotificationServiceType.WEBHOOK;
    private String displayName = "";
    private Boolean enabled = Boolean.TRUE;
    private Map<String, Object> settings = new HashMap<String, Object>();
    private Map<String, String> secretsRef = new HashMap<String, String>();
    private NotificationServiceTestResult lastTestResult = new NotificationServiceTestResult();

    public NotificationServiceConfig() {
        super();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id == null ? "" : id;
    }

    public NotificationServiceType getType() {
        return type;
    }

    public void setType(NotificationServiceType type) {
        this.type = type == null ? NotificationServiceType.WEBHOOK : type;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName == null ? "" : displayName;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled == null ? Boolean.TRUE : enabled;
    }

    public Map<String, Object> getSettings() {
        return settings;
    }

    public void setSettings(Map<String, Object> settings) {
        this.settings = settings == null ? new HashMap<String, Object>() : settings;
    }

    public Map<String, String> getSecretsRef() {
        return secretsRef;
    }

    public void setSecretsRef(Map<String, String> secretsRef) {
        this.secretsRef = secretsRef == null ? new HashMap<String, String>() : secretsRef;
    }

    public NotificationServiceTestResult getLastTestResult() {
        return lastTestResult;
    }

    public void setLastTestResult(NotificationServiceTestResult lastTestResult) {
        this.lastTestResult = lastTestResult == null ? new NotificationServiceTestResult() : lastTestResult;
    }
}
