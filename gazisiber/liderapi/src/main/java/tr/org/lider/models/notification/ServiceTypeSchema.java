package tr.org.lider.models.notification;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ServiceTypeSchema implements Serializable {

    private static final long serialVersionUID = -2418929017683578883L;

    private NotificationServiceType type = NotificationServiceType.WEBHOOK;
    private String labelKey = "";
    private List<ServiceFieldSchema> fields = new ArrayList<ServiceFieldSchema>();

    public ServiceTypeSchema() {
        super();
    }

    public NotificationServiceType getType() {
        return type;
    }

    public void setType(NotificationServiceType type) {
        this.type = type == null ? NotificationServiceType.WEBHOOK : type;
    }

    public String getLabelKey() {
        return labelKey;
    }

    public void setLabelKey(String labelKey) {
        this.labelKey = labelKey == null ? "" : labelKey;
    }

    public List<ServiceFieldSchema> getFields() {
        return fields;
    }

    public void setFields(List<ServiceFieldSchema> fields) {
        this.fields = fields == null ? new ArrayList<ServiceFieldSchema>() : fields;
    }
}
