package tr.org.lider.dto;

import java.util.Date;

public class UserSessionDTO {
	private String username;
	private Date createDate;
	private String hostname;
	private String ipAddresses;
	private String agentStatus;

	private int pageNumber;
	private int pageSize;
	private String sessionType;
	private  Date  startDate;
	private Date endDate;

	public UserSessionDTO(String username, Date createDate, String hostname, String ipAddresses) {
        this.username = username;
        this.createDate = createDate;
        this.hostname = hostname;
        this.ipAddresses = ipAddresses;
    }

	public int getPageNumber() {
		return pageNumber;
	}
	public void setPageNumber(int pageNumber) {
		this.pageNumber = pageNumber;
	}
	public int getPageSize() {
		return pageSize;
	}
	public void setPageSize(int pageSize) {
		this.pageSize = pageSize;
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
	}
	public Date getCreateDate() {
		return createDate;
	}
	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}
	public String getHostname() {
		return hostname;
	}
	public void setHostname(String hostname) {
		this.hostname = hostname;
	}
	public String getIpAddresses() {
		return ipAddresses;
	}
	public void setIpAddresses(String ipAddresses) {
		this.ipAddresses = ipAddresses;
	}
	public String getSessionType() {
		return sessionType;
	}

	public void setSessionType(String sessionType) {
		this.sessionType = sessionType;
	}
	
	public Date getStartDate() {
		return startDate;
	}

	public void setStartDate(Date startDate) {
		this.startDate = startDate;
	}

	public Date getEndDate() {
		return endDate;
	}

	public void setEndDate(Date endDate) {
		this.endDate = endDate;
	}
	public String getAgentStatus() {
		return agentStatus;
	}

	public void setAgentStatus(String agentStatus) {
		this.agentStatus = agentStatus;
	}
}