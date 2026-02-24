package tr.org.lider.security;

/**
 * JWT provider
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
import java.util.Date;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.SignatureException;
import io.jsonwebtoken.UnsupportedJwtException;

@Component
public class JwtProvider {

	private static final Logger logger = LoggerFactory.getLogger(JwtProvider.class);

	@Value("${jwt.secret}")
	private String jwtSecret;

	@Value("${jwt.expiration}")
	private int jwtExpiration;

	public String generateJwtToken(Authentication authentication) {

		User user = (User) authentication.getDetails();
		return Jwts.builder()
				.setSubject((user.getUsername()))
				.setIssuedAt(new Date())
				.setExpiration(new Date((new Date()).getTime() + jwtExpiration*1000))
				.signWith(SignatureAlgorithm.HS512, jwtSecret)
				.compact();
	}

	public boolean validateJwtToken(String authToken) {
		try {
			Jwts.parser().setSigningKey(jwtSecret).parseClaimsJws(authToken);
			return true;
		} catch (SignatureException e) {
			logger.error("Invalid JWT signature -> Message: {} ", e.getMessage());
			return false;
		} catch (MalformedJwtException e) {
			logger.error("Invalid JWT token -> Message: {}", e.getMessage());
			return false;
		} catch (ExpiredJwtException e) {
			logger.error("Expired JWT token -> Message: {}", e.getMessage());
			return false;
		} catch (UnsupportedJwtException e) {
			logger.error("Unsupported JWT token -> Message: {}", e.getMessage());
			return false;
		} catch (IllegalArgumentException e) {
			logger.error("JWT claims string is empty -> Message: {}", e.getMessage());
			return false;
		} catch (LockedException e) {
			logger.error("User is locked -> Message: {}", e.getMessage());
			return false;
		} catch (UsernameNotFoundException e) {
			logger.error("User not found or deleted -> Message: {}", e.getMessage());
			return false;
		}
	}

	public String getUserNameFromJwtToken(String token) {
		return Jwts.parser()
				.setSigningKey(jwtSecret)
				.parseClaimsJws(token)
				.getBody().getSubject();
	}
	
	public Date getJwtExpireDate(String token) {
		return Jwts.parser()
				.setSigningKey(jwtSecret)
				.parseClaimsJws(token)
				.getBody().getExpiration();
	}

}