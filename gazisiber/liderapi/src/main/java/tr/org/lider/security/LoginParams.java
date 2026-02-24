package tr.org.lider.security;

/**
 * JWT login parameters class
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

public class LoginParams {
    @NotBlank
    @Size(max = 60)
    private String username;

    @NotBlank
    private String password;

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

}