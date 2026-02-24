package tr.org.lider.models.notification;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationChannel implements Serializable {

    private static final long serialVersionUID = 8992147221899989874L;

    private String id = "";
    private String name = "";
    private NotificationCategory category = NotificationCategory.NOTIFICATION;
    private Boolean isActive = Boolean.TRUE;
    private List<String> triggerIds = new ArrayList<String>();
    private List<NotificationServiceConfig> services = new ArrayList<NotificationServiceConfig>();
    private NotificationPolicy policy = new NotificationPolicy();
    private String createdAt = null;
    private String updatedAt = null;
    private String updatedBy = null;

    public NotificationChannel() {
        super();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id == null ? "" : id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name == null ? "" : name;
    }

    public NotificationCategory getCategory() {
        return category;
    }

    public void setCategory(NotificationCategory category) {
        this.category = category == null ? NotificationCategory.NOTIFICATION : category;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive == null ? Boolean.TRUE : isActive;
    }

    public List<String> getTriggerIds() {
        return triggerIds;
    }

    public void setTriggerIds(List<String> triggerIds) {
        this.triggerIds = triggerIds == null ? new ArrayList<String>() : triggerIds;
    }

    public List<NotificationServiceConfig> getServices() {
        return services;
    }

    public void setServices(List<NotificationServiceConfig> services) {
        this.services = services == null ? new ArrayList<NotificationServiceConfig>() : services;
    }

    public NotificationPolicy getPolicy() {
        return policy;
    }

    public void setPolicy(NotificationPolicy policy) {
        this.policy = policy == null ? new NotificationPolicy() : policy;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
