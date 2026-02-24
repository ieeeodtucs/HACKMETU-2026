package tr.org.lider.models.notification;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.ObjectMapper;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationSettings implements Serializable {

    private static final long serialVersionUID = -4094171959181237363L;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private Integer version = 1;
    private List<NotificationChannel> channels = new ArrayList<NotificationChannel>();
    private List<NotificationServiceConfig> savedServiceProfiles = new ArrayList<NotificationServiceConfig>();
    private List<NotificationTrigger> triggerCatalog = new ArrayList<NotificationTrigger>();
    private List<ServiceTypeSchema> serviceTypeSchemas = new ArrayList<ServiceTypeSchema>();
    private String updatedAt = null;
    private String updatedBy = null;

    public NotificationSettings() {
        super();
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version == null ? 1 : version;
    }

    public List<NotificationChannel> getChannels() {
        return channels;
    }

    public void setChannels(List<NotificationChannel> channels) {
        this.channels = channels == null ? new ArrayList<NotificationChannel>() : channels;
    }

    public List<NotificationTrigger> getTriggerCatalog() {
        return triggerCatalog;
    }

    public void setTriggerCatalog(List<NotificationTrigger> triggerCatalog) {
        this.triggerCatalog = triggerCatalog == null ? new ArrayList<NotificationTrigger>() : triggerCatalog;
    }

    public List<NotificationServiceConfig> getSavedServiceProfiles() {
        return savedServiceProfiles;
    }

    @JsonSetter("savedServiceProfiles")
    public void setSavedServiceProfiles(Object rawSavedServiceProfiles) {
        this.savedServiceProfiles = normalizeSavedServiceProfiles(rawSavedServiceProfiles);
    }

    @JsonSetter("serviceProfiles")
    public void setLegacyServiceProfilesRaw(Object rawSavedServiceProfiles) {
        setSavedServiceProfiles(rawSavedServiceProfiles);
    }

    public List<ServiceTypeSchema> getServiceTypeSchemas() {
        return serviceTypeSchemas;
    }

    public void setServiceTypeSchemas(List<ServiceTypeSchema> serviceTypeSchemas) {
        this.serviceTypeSchemas = serviceTypeSchemas == null ? new ArrayList<ServiceTypeSchema>() : serviceTypeSchemas;
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

    private List<NotificationServiceConfig> normalizeSavedServiceProfiles(Object rawSavedServiceProfiles) {
        List<NotificationServiceConfig> normalized = new ArrayList<NotificationServiceConfig>();
        if (rawSavedServiceProfiles == null) {
            return normalized;
        }

        if (rawSavedServiceProfiles instanceof List<?>) {
            List<?> list = (List<?>) rawSavedServiceProfiles;
            for (Object item : list) {
                NotificationServiceConfig converted = convertToServiceProfile(item);
                if (converted != null) {
                    normalized.add(converted);
                }
            }
            return normalized;
        }

        if (rawSavedServiceProfiles instanceof Map<?, ?> || rawSavedServiceProfiles instanceof String) {
            if (rawSavedServiceProfiles instanceof String) {
                String rawValue = ((String) rawSavedServiceProfiles).trim();
                if (rawValue.startsWith("[")) {
                    try {
                        List<?> parsedList = OBJECT_MAPPER.readValue(rawValue, List.class);
                        for (Object item : parsedList) {
                            NotificationServiceConfig converted = convertToServiceProfile(item);
                            if (converted != null) {
                                normalized.add(converted);
                            }
                        }
                    } catch (Exception e) {
                        // ignore malformed legacy payloads
                    }
                    return normalized;
                }
            }
            NotificationServiceConfig converted = convertToServiceProfile(rawSavedServiceProfiles);
            if (converted != null) {
                normalized.add(converted);
            }
        }

        return normalized;
    }

    private NotificationServiceConfig convertToServiceProfile(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof NotificationServiceConfig) {
            return (NotificationServiceConfig) value;
        }
        if (value instanceof String) {
            String rawValue = ((String) value).trim();
            if (rawValue.startsWith("{")) {
                try {
                    return OBJECT_MAPPER.readValue(rawValue, NotificationServiceConfig.class);
                } catch (Exception e) {
                    return null;
                }
            }
        }
        try {
            return OBJECT_MAPPER.convertValue(value, NotificationServiceConfig.class);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
