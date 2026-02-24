package tr.org.lider.utils;

import java.util.Date;
import java.util.Optional;

import tr.org.lider.entities.SessionEvent;

public interface IUserSessionReport {
	
	int getSessionEvent();

    void setSessionEvent(int sessionEvent);
	
	String getUsername() ;
	
	void setUsername(String username);
	
    Date getCreateDate();
    
    void setCreateDate(Date createDate);
    
    String getHostname();
    
	void setHostname(String hostname);

    String getIpAddresses();
    
	void setIpAddresses(String ipAddresses);
	
	String getMacAddresses();
    
	void setMacAddresses(String macAddresses);
	
	String getAgentStatus();
	
	void setAgentStatus(String agentStatus);
	
	

	
}
