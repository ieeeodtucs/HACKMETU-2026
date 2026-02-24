package tr.org.lider.models.notification;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationServiceTestResult implements Serializable {

    private static final long serialVersionUID = -8236628023988866023L;

    private NotificationTestStatus status = NotificationTestStatus.IDLE;
    private String message = null;
    private String testedAt = null;

    public NotificationServiceTestResult() {
        super();
    }

    public NotificationTestStatus getStatus() {
        return status;
    }

    public void setStatus(NotificationTestStatus status) {
        this.status = status == null ? NotificationTestStatus.IDLE : status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getTestedAt() {
        return testedAt;
    }

    public void setTestedAt(String testedAt) {
        this.testedAt = testedAt;
    }
}
