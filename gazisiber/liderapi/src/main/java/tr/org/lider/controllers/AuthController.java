package tr.org.lider.controllers;

import javax.cache.Cache;
import javax.cache.CacheManager;

/**
 * Service auth controller
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.OperationType;
import tr.org.lider.security.AESHash;
import tr.org.lider.security.JwtProvider;
import tr.org.lider.security.JwtResponse;
import tr.org.lider.security.LoginParams;
import tr.org.lider.security.User;
import tr.org.lider.services.AuthenticationService;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;
import tr.org.lider.services.OperationLogService;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/auth")
@Tag(name = "authenticate", description = "Authentication Rest Service")
public class AuthController {

	Logger logger = LoggerFactory.getLogger(AuthController.class);

	//@Value("classpath:ehcache.xml")
	//	private CacheManager cacheManager;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private AuthenticationManager authenticationManager;

	@Autowired
	private OperationLogService operationLogService; 

	@Autowired
	private JwtProvider jwtProvider;

	@Autowired
	private NotificationDispatchService notificationDispatchService;

	@Value("${jwt.secret}")
	private String jwtSecret;

	@Value("${jwt.expiration}")
	private int jwtExpiration;
	
	
	@Operation(summary = "", description = "", tags = { "authenticate" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Authentication has been done."),
			  @ApiResponse(responseCode = "400", description = "Authentication failed. Bad Request.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/signin")
	public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginParams loginParams, HttpServletRequest request) {
		Authentication authentication = null;
		try {
			authentication = authenticationManager.authenticate(
					new UsernamePasswordAuthenticationToken(
							loginParams.getUsername().trim(), loginParams.getPassword().trim()));
			SecurityContextHolder.getContext().setAuthentication(authentication);
			User userPrincipal = (User)authentication.getDetails();

			String jwt = jwtProvider.generateJwtToken(authentication);
			String tokenData = AESHash.encrypt(loginParams.getPassword(), jwtSecret + jwt);
			Cache<String, String> cache = cacheManager.getCache("userCache");
			cache.put(jwt, tokenData);
			operationLogService.saveOperationLog(OperationType.LOGIN,"User logged in",null);
			notificationDispatchService.dispatch("user.login",
					"Kullanıcı Giriş Yaptı: " + loginParams.getUsername(),
					new NotificationBodyBuilder()
							.field("Kullanıcı", loginParams.getUsername())
							.build());
			return ResponseEntity.ok(new JwtResponse(jwt, userPrincipal.getName(), userPrincipal.getSurname()));
		} catch (BadCredentialsException e) {
			logger.warn("Username: " + loginParams.getUsername() + " requested to login but username or password is wrong. Returned: " + HttpStatus.NOT_FOUND);
			notificationDispatchService.dispatch("user.login.failed",
					"Başarısız Giriş Denemesi: " + loginParams.getUsername(),
					new NotificationBodyBuilder()
							.field("Denenen Kullanıcı", loginParams.getUsername())
							.field("Sebep", "Kullanıcı adı veya parola hatalı")
							.build());
			return new ResponseEntity<String>("Username or password is wrong", HttpStatus.NOT_FOUND);
		} catch (LockedException e) {
			logger.warn("Username: " + loginParams.getUsername() + " requested to login but user account is locked. Returned: " + HttpStatus.LOCKED);
			notificationDispatchService.dispatch("user.login.failed",
					"Başarısız Giriş Denemesi: " + loginParams.getUsername(),
					new NotificationBodyBuilder()
							.field("Denenen Kullanıcı", loginParams.getUsername())
							.field("Sebep", "Hesap kilitli")
							.build());
			return new ResponseEntity<String>("User account is locked", HttpStatus.LOCKED);
		} catch(DisabledException e) {
			logger.warn("Username: " + loginParams.getUsername() + " requested to login but user account is disabled. Returned: " + HttpStatus.FORBIDDEN);
			notificationDispatchService.dispatch("user.login.failed",
					"Başarısız Giriş Denemesi: " + loginParams.getUsername(),
					new NotificationBodyBuilder()
							.field("Denenen Kullanıcı", loginParams.getUsername())
							.field("Sebep", "Hesap devre dışı")
							.build());
			return new ResponseEntity<String>("User account is disabled", HttpStatus.FORBIDDEN);
		} catch(Exception e) {
			logger.error(e.getMessage());
			logger.warn("Username: " + loginParams.getUsername() + " requested to login but other exception occured. Returned: " + HttpStatus.SEE_OTHER);
			notificationDispatchService.dispatch("user.login.failed",
					"Başarısız Giriş Denemesi: " + loginParams.getUsername(),
					new NotificationBodyBuilder()
							.field("Denenen Kullanıcı", loginParams.getUsername())
							.field("Sebep", "Beklenmeyen hata")
							.build());
			return new ResponseEntity<String>("Login failed", HttpStatus.SEE_OTHER);
		}
	}
	
	@Operation(summary = "", description = "", tags = { "authenticate" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Authentication has been done."),
			  @ApiResponse(responseCode = "400", description = "Authentication failed. Bad Request.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/logout")
	public ResponseEntity<String> logout(Model model, Authentication authentication) {
		String username = AuthenticationService.getUserName();
		operationLogService.saveOperationLog(OperationType.LOGOUT,"User logout", null);
		notificationDispatchService.dispatch("user.logout",
				"Kullanıcı Çıkış Yaptı: " + username,
				new NotificationBodyBuilder()
						.field("Kullanıcı", username)
						.build());
		return new ResponseEntity<String>("logout", HttpStatus.OK);
	}
}
