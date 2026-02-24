package tr.org.lider.entities;

import java.io.Serializable;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.ObjectMapper;

@Entity
@Table(name = "Server")
public class ServerImpl implements Serializable {

	private static final long serialVersionUID = 7634830693350923198L;

	@Id
	@GeneratedValue
	@Column(name = "SERVER_ID", unique = true,nullable = false)
	private Long id;
	
	@Column(name = "IP")
	private String ip;
	
	@Column(name = "MACHINE_NAME")
	private String machineName;

	@Column(name = "DESCRIPTION")
	private String description;
	
	@Column(name = "USER")
	private String user;
	
	@Column(name = "STATUS")
	private Boolean status;
	
	@Column(name = "PASSWORD")
	private String password;
	
	@Temporal(TemporalType.TIMESTAMP)
	@Column(name = "CREATE_DATE", nullable = false, updatable = false)
	@CreationTimestamp
	@JsonFormat(pattern="dd/MM/yyyy HH:mm:ss", timezone="Europe/Istanbul")
	private Date createDate;

	@Temporal(TemporalType.TIMESTAMP)
	@Column(name = "MODIFY_DATE")
	@JsonFormat(pattern="dd/MM/yyyy HH:mm:ss", timezone="Europe/Istanbul")
	private Date modifyDate;

	@OneToMany(mappedBy = "server", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
	private Set<ServerInformationImpl> properties = new HashSet<ServerInformationImpl>(0); // bidirectional

	@OneToMany(mappedBy = "server", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = false)
	//@OrderBy("createDate DESC")

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}
	
	public String getMachineName() {
		return machineName;
	}

	public void setMachineName(String machineName) {
		this.machineName = machineName;
	}

	public String getIp() {
		return ip;
	}

	public void setIp(String ip) {
		this.ip = ip;
	}


	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getUser() {
		return user;
	}

	public void setUser(String user) {
		this.user = user;
	}

	public Boolean getStatus() {
		return status;
	}

	public void setStatus(Boolean status) {
		this.status = status;
	}
	
	public Set<ServerInformationImpl> getProperties() {
		return properties;
	}

	public void setProperties(Set<ServerInformationImpl> properties) {
		this.properties = properties;
	}
	
	public Date getCreateDate() {
		return createDate;
	}

	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}

	public Date getModifyDate() {
		return modifyDate;
	}

	public void setModifyDate(Date modifyDate) {
		this.modifyDate = modifyDate;
	}
	
	public ServerImpl() {
		
	}
	
	public ServerImpl(Long id, String description, String machineName, String ip, 
			String password, Boolean status, Date createDate, Date modifyDate, String user, Set<ServerInformationImpl> properties) {
		
		super();
		this.id = id;
		this.description = description;
		this.machineName = machineName;
		this.ip = ip;
		this.password = password;
		this.status = status;
		this.user = user;
		this.createDate = createDate;
		this.modifyDate = modifyDate;
		this.properties = properties;

	}
	
	public ServerImpl(ServerImpl server) {
		this.id = server.id;
		this.description = server.description;
		this.machineName = server.machineName;
		this.ip = server.ip;
		this.password = server.password;
		this.status = server.status;
		this.user = server.user;
		this.createDate = server.createDate;
		this.modifyDate = server.modifyDate;
		this.properties = server.properties;

	}
	
	public void addProperty(ServerInformationImpl property) {
		if(properties == null) {
			properties = new HashSet<ServerInformationImpl>(0);
		}
		
		if(property.getServer() != this) {
			property.setServer(this);
		}
		boolean found = false;
		for (ServerInformationImpl tmp : properties) {
			if(tmp.equals(property)) {
				tmp.setPropertyValue(property.getPropertyValue());
				found = true;
				break;
			}
		}
		
		if(!found) {
			properties.add(property);
		}
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
	
	@Override
	public String toString() {
		return "ServerImpl [id=" + id + ", description=" + description + ", machineName=" + machineName + ", ip=" + ip + " , "
				+ "password=" + password + ", status=" + status + ", user=" + user + " , createDate=" + createDate + ", modifyDate=" + modifyDate + "]";
				}
}
