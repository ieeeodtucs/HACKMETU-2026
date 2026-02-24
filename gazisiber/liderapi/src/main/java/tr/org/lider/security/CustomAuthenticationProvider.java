package tr.org.lider.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

/**
 * Custom Authentication Provider
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

@Component
public class CustomAuthenticationProvider implements AuthenticationProvider {

	@Autowired
	private UserDetailsService userDetailsService;

	@Autowired
	private CustomPasswordEncoder passwordEncoder;

	@Override
	public Authentication authenticate(Authentication authentication) throws AuthenticationException {
		String username = authentication.getName();
		String password = String.valueOf(authentication.getCredentials());

		User userDetails = (User) userDetailsService.loadUserByUsername(username);
		if (passwordEncoder.matches(password, userDetails.getPassword())){
			UsernamePasswordAuthenticationToken authenticationToken =
					new UsernamePasswordAuthenticationToken(userDetails, password, userDetails.getAuthorities());
			userDetails.setPasswordHashed(userDetails.getPassword());
			userDetails.setPassword(password);
			authenticationToken.setDetails(userDetails);
			return authenticationToken;
		}
		throw new BadCredentialsException("User login failed!");
	}

	/**
	 * Because I am going to use HttpBasicAuthentication
	 * and HttpBasicAuthentication uses UsernamePasswordAuthenticationToken
	 * @param authenticationType
	 * @return
	 */
	@Override
	public boolean supports(Class<?> authenticationType) {
		return UsernamePasswordAuthenticationToken.class.equals(authenticationType);
	}
	
}
