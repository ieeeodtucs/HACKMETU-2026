package tr.org.lider.models.notification;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ServiceFieldSchema implements Serializable {

    private static final long serialVersionUID = -8008662162503751591L;

    private String key = "";
    private String labelKey = "";
    private String inputType = "text";
    private Boolean required = Boolean.FALSE;
    private Boolean secret = Boolean.FALSE;
    private Boolean repeatable = Boolean.FALSE;
    private String placeholder = "";

    public ServiceFieldSchema() {
        super();
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key == null ? "" : key;
    }

    public String getLabelKey() {
        return labelKey;
    }

    public void setLabelKey(String labelKey) {
        this.labelKey = labelKey == null ? "" : labelKey;
    }

    public String getInputType() {
        return inputType;
    }

    public void setInputType(String inputType) {
        this.inputType = inputType == null ? "text" : inputType;
    }

    public Boolean getRequired() {
        return required;
    }

    public void setRequired(Boolean required) {
        this.required = required == null ? Boolean.FALSE : required;
    }

    public Boolean getSecret() {
        return secret;
    }

    public void setSecret(Boolean secret) {
        this.secret = secret == null ? Boolean.FALSE : secret;
    }

    public Boolean getRepeatable() {
        return repeatable;
    }

    public void setRepeatable(Boolean repeatable) {
        this.repeatable = repeatable == null ? Boolean.FALSE : repeatable;
    }

    public String getPlaceholder() {
        return placeholder;
    }

    public void setPlaceholder(String placeholder) {
        this.placeholder = placeholder == null ? "" : placeholder;
    }
}
