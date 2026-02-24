package tr.org.lider.services;

/**
 * Static spring security principal user service for retrieving logged in user details
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import tr.org.lider.security.User;


public class AuthenticationService {
	public static boolean isLogged() {
		final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		return null != authentication && !("anonymousUser").equals(authentication.getName());
	}
	
	public static User getUser() {
		final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User userPrincipal = (User)authentication.getPrincipal();
		return userPrincipal;
	}
	
	public static String getUserName() {
		final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User userPrincipal = (User)authentication.getPrincipal();
		return userPrincipal.getUsername();
	}

	public static String getDn() {
		final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User userPrincipal = (User)authentication.getPrincipal();
		return userPrincipal.getDn();
	}

	public static String getPassword() {
		final Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User userPrincipal = (User)authentication.getPrincipal();
		return userPrincipal.getPassword();
	}
	
	public static void logoutUser() {
		SecurityContextHolder.getContext().setAuthentication(null);
	}
	
}