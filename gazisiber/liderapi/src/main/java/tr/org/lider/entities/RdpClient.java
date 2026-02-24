package tr.org.lider.entities;

import java.io.Serializable;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;

import com.fasterxml.jackson.databind.ObjectMapper;

@Entity
public class RdpClient implements Serializable {
    private static final long serialVersionUID = 8344837155045058296L;

	@Id
    @GeneratedValue
    @Column(name = "CLIENT_ID", unique = true, nullable = false)
    private Long id;

    @Column(name = "HOST", unique = true, nullable = false)
    private String host;

    @Column(name = "USERNAME", nullable = false)
    private String username;

    @Column(name = "HOSTNAME", nullable = true)
    private String hostname;

    @Column(name = "DESCRIPTION", nullable = true)
    private String description;

    public RdpClient() {
    }

    public RdpClient(String host, String username) {
        this.host = host;
        this.username = username;
    }

    public RdpClient(String host, String username, String hostname, String description) {
        this.host = host;
        this.username = username;
        this.hostname = hostname;
        this.description = description;
    }

    public RdpClient(Long id, String host, String username, String hostname, String description) {
        this.id = id;
        this.host = host;
        this.username = username;
        this.hostname = hostname;
        this.description = description;
    }

    public RdpClient(Long id, String host, String username) {
        this.id = id;
        this.host = host;
        this.username = username;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String toJson() {
        ObjectMapper mapper = new ObjectMapper();
        try {
            return mapper.writeValueAsString(this);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    public String toString() {
        return "RdpClient{" +
                "id=" + id +
                ", host='" + host + '\'' +
                ", username='" + username + '\'' +
                '}';
    }

    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (!(o instanceof RdpClient))
            return false;

        RdpClient rdpClient = (RdpClient) o;

        if (getId() != null ? !getId().equals(rdpClient.getId()) : rdpClient.getId() != null)
            return false;
        if (getHost() != null ? !getHost().equals(rdpClient.getHost()) : rdpClient.getHost() != null)
            return false;
        return getUsername() != null ? getUsername().equals(rdpClient.getUsername()) : rdpClient.getUsername() == null;
    }

}
