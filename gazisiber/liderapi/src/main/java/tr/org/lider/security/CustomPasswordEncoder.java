package tr.org.lider.security;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Argon2 Password Encoder
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

@Service
public class CustomPasswordEncoder implements PasswordEncoder {
	
	Argon2PasswordEncoder passwordEncoder = new Argon2PasswordEncoder();
	
	@Override
	public String encode(CharSequence rawPassword) {
		return passwordEncoder.encode(String.valueOf(rawPassword));
	}

	@Override
	public boolean matches(CharSequence rawPassword, String encodedPassword) {
		if(encodedPassword != null && !encodedPassword.equals("") && encodedPassword.startsWith("{ARGON2}")) {
			encodedPassword = encodedPassword.replace("{ARGON2}", "");
		}
		if(passwordEncoder.matches(rawPassword, encodedPassword)) {
			return true;
		}
		return false;
	}
}