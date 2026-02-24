package tr.org.lider.dto;

public class AgentSessionDTO {

	private int pageNumber;
	private int pageSize;
	private Long agentID;
	private String sessionType;
	
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
	public Long getAgentID() {
		return agentID;
	}
	public void setAgentID(Long agentID) {
		this.agentID = agentID;
	}
	public String getSessionType() {
		return sessionType;
	}
	public void setSessionType(String sessionType) {
		this.sessionType = sessionType;
	}
}
