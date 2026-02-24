package tr.org.lider.models.notification;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPolicy implements Serializable {

    private static final long serialVersionUID = 3875936552233488775L;

    private Integer cooldownSeconds = 0;
    private Integer dedupWindowSeconds = 0;
    private Integer maxPerMinute = 0;

    public NotificationPolicy() {
        super();
    }

    public Integer getCooldownSeconds() {
        return cooldownSeconds;
    }

    public void setCooldownSeconds(Integer cooldownSeconds) {
        this.cooldownSeconds = cooldownSeconds == null ? 0 : cooldownSeconds;
    }

    public Integer getDedupWindowSeconds() {
        return dedupWindowSeconds;
    }

    public void setDedupWindowSeconds(Integer dedupWindowSeconds) {
        this.dedupWindowSeconds = dedupWindowSeconds == null ? 0 : dedupWindowSeconds;
    }

    public Integer getMaxPerMinute() {
        return maxPerMinute;
    }

    public void setMaxPerMinute(Integer maxPerMinute) {
        this.maxPerMinute = maxPerMinute == null ? 0 : maxPerMinute;
    }
}
