package tr.org.lider.security;

/**
 * JWT Auth entry token filter
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
import java.io.IOException;

import javax.cache.Cache;
import javax.cache.CacheManager;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AccountExpiredException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.MalformedJwtException;
import tr.org.lider.services.UserService;


public class JwtAuthTokenFilter extends OncePerRequestFilter {

	@Autowired
	private JwtProvider tokenProvider;

	@Autowired
	private UserService userService;
	
	@Autowired
	private CacheManager cacheManager;
	
	@Value("${jwt.secret}")
	private String jwtSecret;

	@Value("${jwt.expiration}")
	private int jwtExpiration;
	
	private static final Logger logger = LoggerFactory.getLogger(JwtAuthTokenFilter.class);

	@Override
	protected void doFilterInternal(HttpServletRequest request, 
			HttpServletResponse response, 
			FilterChain filterChain) 
					throws ServletException, IOException {
		try {
			String jwt = getJwt(request);
			if (jwt != null && tokenProvider.validateJwtToken(jwt)) {
				String username = tokenProvider.getUserNameFromJwtToken(jwt);
				User userDetails = userService.loadUserByUsername(username);
				Cache<String, String> cache = cacheManager.getCache("userCache");
				try {
					String tokenData = (String) cache.get(jwt);
				    userDetails.setPasswordHashed(userDetails.getPassword());
				    userDetails.setPassword(AESHash.decrypt(tokenData, jwtSecret + jwt));
				} catch (Exception e) {
					throw new MalformedJwtException("JWT not found in cache!");
				}

				if (!userDetails.isAccountNonLocked()) {
					throw new LockedException("User account is locked");
				} else if (!userDetails.isEnabled()) {
					throw new DisabledException("User is disabled");
				} else if (!userDetails.isAccountNonExpired()) {
					cache.getAndRemove(jwt);
					throw new AccountExpiredException("User account has expired");
				} else if (!userDetails.isCredentialsNonExpired()) {
					throw new CredentialsExpiredException("User credentials have expired");
				} else {
					UsernamePasswordAuthenticationToken authentication 
					= new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
					authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
					SecurityContextHolder.getContext().setAuthentication(authentication);
				}
			}
		} catch (Exception e) {
			logger.error("Can NOT set user authentication -> Message: {}", e);
			response.addHeader("reason", e.getClass().getSimpleName());
		}
		filterChain.doFilter(request, response);
	}

	private String getJwt(HttpServletRequest request) {
		String authHeader = request.getHeader("Authorization");
		if (authHeader != null && authHeader.startsWith("Bearer ")) {
			return authHeader.replace("Bearer ","");
		}
		return null;
	}
}