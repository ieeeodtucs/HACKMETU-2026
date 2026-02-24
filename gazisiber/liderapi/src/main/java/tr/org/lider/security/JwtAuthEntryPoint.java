package tr.org.lider.security;

/**
 * JWT Auth entry point
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

@Component
public class JwtAuthEntryPoint implements AuthenticationEntryPoint {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthEntryPoint.class);
    
    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException e) 
                        		 throws IOException, ServletException {
    	//TODO delete in prod
//	    StringBuilder requestURL = new StringBuilder(request.getRequestURL().toString());
//	    String queryString = request.getQueryString();
//	    if (queryString == null && requestURL.toString().equals("http://localhost:8080/")) {
//	        System.err.println("URL 1 : " + requestURL.toString());
//	        response.sendRedirect(requestURL.toString() + "index.html");
//	        return;
//	    }
	    
    	//TODO delete in prod
	    StringBuilder requestURL = new StringBuilder(request.getRequestURL().toString());
	    String queryString = request.getQueryString();
	    if (queryString == null) {
	        System.err.println("URL 1 : " + requestURL.toString());
	        String redirectURL = request.getScheme() + "://" + request.getHeader("host") + "/index.html";
	        response.sendRedirect(redirectURL);
	        return;
	    }
	    
        logger.error("Unauthorized error. Message - {}", e.getMessage());
        if(response.getHeader("reason") != null && !response.getHeader("reason").equals("")) {
        	String reason = response.getHeader("reason");
        	if(reason.equals("SignatureException")) {
        		response.sendError(HttpStatus.BAD_REQUEST.value(), "JWT token error. SignatureException occured");
        	} else if(reason.equals("MalformedJwtException")) {
        		response.sendError(HttpStatus.BAD_REQUEST.value(), "JWT token error. MalformedJwtException occured");
        	} else if(reason.equals("ExpiredJwtException")) {
        		response.sendError(HttpStatus.UPGRADE_REQUIRED.value(), "JWT token is expired. ExpiredJwtException occured");
        	} else if(reason.equals("UnsupportedJwtException")) {
        		response.sendError(HttpStatus.BAD_REQUEST.value(), "JWT token error. UnsupportedJwtException occured");
        	} else if(reason.equals("IllegalArgumentException")) {
        		response.sendError(HttpStatus.BAD_REQUEST.value(), "JWT token error. IllegalArgumentException occured");
        	} else if(reason.equals("LockedException")) {
        		response.sendError(HttpStatus.LOCKED.value(), "User is locked. LockedException occured");
        	} else if(reason.equals("UsernameNotFoundException")) {
        		response.sendError(HttpStatus.NOT_FOUND.value(), "Username or password is wrong. UsernameNotFoundException occured");
        	} else if(reason.equals("AccessDeniedException")) {
        		response.sendError(HttpStatus.PRECONDITION_REQUIRED.value(), "User is not on street officer");
        	} else {
        		response.sendError(HttpStatus.BAD_REQUEST.value(), "JWT token error occured");
        	}
        } else {
        	response.sendError(HttpStatus.BAD_REQUEST.value(), "JWT token error occured");
        }
        
    }
}