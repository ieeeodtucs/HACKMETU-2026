package tr.org.lider.models.notification;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationTrigger implements Serializable {

    private static final long serialVersionUID = -5676908692344711578L;

    private String id = "";
    private String labelKey = "";
    private NotificationTriggerDomain domain = NotificationTriggerDomain.SYSTEM;
    private NotificationSeverity severity = NotificationSeverity.INFO;
    private Boolean defaultEnabled = Boolean.FALSE;
    private Boolean isSystem = Boolean.TRUE;

    public NotificationTrigger() {
        super();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id == null ? "" : id;
    }

    public String getLabelKey() {
        return labelKey;
    }

    public void setLabelKey(String labelKey) {
        this.labelKey = labelKey == null ? "" : labelKey;
    }

    public NotificationTriggerDomain getDomain() {
        return domain;
    }

    public void setDomain(NotificationTriggerDomain domain) {
        this.domain = domain == null ? NotificationTriggerDomain.SYSTEM : domain;
    }

    public NotificationSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(NotificationSeverity severity) {
        this.severity = severity == null ? NotificationSeverity.INFO : severity;
    }

    public Boolean getDefaultEnabled() {
        return defaultEnabled;
    }

    public void setDefaultEnabled(Boolean defaultEnabled) {
        this.defaultEnabled = defaultEnabled == null ? Boolean.FALSE : defaultEnabled;
    }

    public Boolean getIsSystem() {
        return isSystem;
    }

    public void setIsSystem(Boolean isSystem) {
        this.isSystem = isSystem == null ? Boolean.TRUE : isSystem;
    }
}
