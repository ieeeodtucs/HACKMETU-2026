package tr.org.lider.security;

import tr.org.lider.models.ConfigParams;

/**
 * JWT response paramters class
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

public class JwtResponse {
    private String token;
    private String type = "Bearer";
    private String name = "";
    private String surname = "";
    private User user ;
    private ConfigParams configParams ;

    public JwtResponse(String token, String name, String surname) {
        this.token = token;
        this.name = name;
        this.surname = surname;
    }
    public JwtResponse(String token, User user, ConfigParams configParams) {
    	this.token = token;
    	this.user = user;
    	this.configParams=configParams;
    }

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getSurname() {
		return surname;
	}

	public void setSurname(String surname) {
		this.surname = surname;
	}
	public User getUser() {
		return user;
	}
	public void setUser(User user) {
		this.user = user;
	}
	public ConfigParams getConfigParams() {
		return configParams;
	}
	public void setConfigParams(ConfigParams configParams) {
		this.configParams = configParams;
	}

}