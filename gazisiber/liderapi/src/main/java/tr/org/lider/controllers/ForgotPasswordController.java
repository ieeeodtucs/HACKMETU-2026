package tr.org.lider.controllers;

import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.apache.directory.api.ldap.model.message.SearchScope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.ForgotPasswordImpl;
import tr.org.lider.entities.OperationType;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.EmailService;
import tr.org.lider.services.ForgotPasswordService;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;
import tr.org.lider.services.OperationLogService;

/**
 * 
 * @author Hasan Kara
 */
@RestController
@RequestMapping(value = "/api/forgot-password")
@Tag(name = "forgot-password", description = "Forgot Password Rest Service")
public class ForgotPasswordController {

	Logger logger = LoggerFactory.getLogger(ForgotPasswordController.class);

	@Autowired
	private ConfigurationService configurationService;

	@Autowired
	private LDAPServiceImpl ldapService;

	@Autowired
	private EmailService emailService;

	@Autowired
	private ForgotPasswordService forgotPasswordService;
	
	@Autowired
	private OperationLogService operationLogService;

	@Autowired
	private NotificationDispatchService notificationDispatchService;

	@Value("${lider.url}")
	private String liderURL;
	
	/*
	 * creates a uuuid for password change and sends an email to user with a link.
	 * Link is valid for 60 minutes.
	 */
	@Operation(summary = "Sending email to confirm password", description = "", tags = { "forgot-password" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "The link has been successfully sent to your email."),
			  @ApiResponse(responseCode = "404", description = "Email information could not be verified. Not found", 
			    content = @Content(schema = @Schema(implementation = String.class))),
			  @ApiResponse(responseCode = "417", description = "An unexpected error occurred while sending the email", 
			    content = @Content(schema = @Schema(implementation = String.class)))})
	@PostMapping(value = "/")
	public ResponseEntity<?> forgotPasswordSendLink(@RequestBody Map<String,String> params) {
		//get full current url of lider server to send reset link to user
		if(!params.containsKey("username")) {
			return new ResponseEntity<List<String>>(Arrays.asList("Email parametresi zorunludur."), HttpStatus.NOT_FOUND);
		}
		String username = params.get("username");
		String fullURL = liderURL;
		
		Boolean isEmailSent = false;
		if(!configurationService.isEmailConfigurationComplete()) {
			String errorMessage = "Henüz Lider üzerinden email ayarlarınız yapılmamıştır. "
					+ "Lütfen parola sıfırlama linki alabilmek için öncelikle Ayarlar > Email Ayarları sayfasından email ayarlarınızı tamamlayınız.";
			return new ResponseEntity<List<String>>(Arrays.asList(errorMessage), HttpStatus.EXPECTATION_FAILED);
		}
		LdapEntry ldapEntry=null;
		try {
			configurationService.destroyConfigParams();
			String filter= "(&(objectClass=pardusAccount)(objectClass=pardusLider)(liderPrivilege=ROLE_USER)(uid=$1))".replace("$1", username);
			List<LdapEntry> ldapEntries  = ldapService.findSubEntries(filter,
					new String[] { "*" }, SearchScope.SUBTREE);

			if(ldapEntries.size()>0) {
				ldapEntry=ldapEntries.get(0);
			}
		} catch (Exception e) {
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.
					status(HttpStatus.EXPECTATION_FAILED).
					headers(headers)
					.build();
		}
		if(ldapEntry!=null) {
			if(!ldapEntry.getAttributes().containsKey("mail")) {
				return new ResponseEntity<List<String>>(Arrays.asList("Bu kullanıcı için henüz mail bilgisi eklenmemiştir."), HttpStatus.EXPECTATION_FAILED);
			}
			Optional<ForgotPasswordImpl> fp = forgotPasswordService.findAllByUsername(username);
			if(fp.isPresent()) {
				forgotPasswordService.deleteByUsername(username);
			}
			String userEmail = ldapEntry.getAttributes().get("mail");
			isEmailSent = emailService.sendmail(username, userEmail, fullURL);
		}
		else {
			return new ResponseEntity<List<String>>(Arrays.asList("Kullanıcı adı bulunamadı."), 
					HttpStatus.NOT_FOUND);
		}
		if(isEmailSent) {
			notificationDispatchService.dispatch("user.password.forgot",
					"Şifre Sıfırlama Talebi: " + username,
					new NotificationBodyBuilder()
						.field("Kullanıcı", username)
						.build());
			return new ResponseEntity<List<String>>(Arrays.asList("Parola yenileme linki email adresinize gönderildi."), 
					HttpStatus.OK);
		} else {
			return new ResponseEntity<List<String>>(Arrays.asList("Email gönderilirken hata oluştu lütfen tekrar deneyiniz."), 
					HttpStatus.EXPECTATION_FAILED);
		}

	}
	
	/*
	 * checks if user password change link is still valid
	 * 
	 */
	@Operation(summary = "Password reset", description = "", tags = { "forgot-password" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Password reset successfully"),
			  @ApiResponse(responseCode = "417", description = "Could not reset password. Unexpected error occured", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/id/{uuid}")
	public ResponseEntity<?> passwordResetPage(@PathVariable String uuid) {
		
		Optional<ForgotPasswordImpl> fp = forgotPasswordService.findAllByUUID(uuid);
		if(!fp.isPresent()) {
			return new ResponseEntity<List<String>>(Arrays.asList("Parola yenileme linki bulunamadı veya bu linkin süresi doldu."), 
					HttpStatus.EXPECTATION_FAILED);
		} else {
			long linkAllowedTill= fp.get().getCreateDate().getTime() + 1000*60*60;
			long nowMillis = new Date().getTime();
			if(linkAllowedTill < nowMillis) {
				return new ResponseEntity<List<String>>(Arrays.asList("Link süresi doldu."), 
						HttpStatus.EXPECTATION_FAILED);
			} else {
				return new ResponseEntity<List<String>>(Arrays.asList(uuid), 
						HttpStatus.OK);
			}
		}
	}
	
	/*
	 * changes user password
	 * 
	 */
	@Operation(summary = "Password reset and save", description = "", tags = { "forgot-password" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Password reset and save successful"),
			  @ApiResponse(responseCode = "417", description = "Password reset and save failed. Unexpected error occured", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/reset/{uuid}")
	public ResponseEntity<?> passwordResetSave(@PathVariable String uuid, 
			@RequestBody Map<String,String> params) {
		String password = "";
		String repeatPassword = "";

		Optional<ForgotPasswordImpl> fp = forgotPasswordService.findAllByUUID(uuid);
		if(!fp.isPresent()) {
			return new ResponseEntity<List<String>>(Arrays.asList("Parola yenileme linki bulunamadı veya bu linkin süresi doldu."), 
					HttpStatus.EXPECTATION_FAILED);
		} else {
			long linkAllowedTill= fp.get().getCreateDate().getTime() + 1000*60*60;
			long nowMillis = new Date().getTime();
			if(linkAllowedTill < nowMillis) {
				return new ResponseEntity<List<String>>(Arrays.asList("Link süresi doldu."), 
						HttpStatus.EXPECTATION_FAILED);
			} else {
				if(!params.containsKey("password")) {
					return new ResponseEntity<List<String>>(Arrays.asList("Parola parametresi zorunludur."), HttpStatus.NOT_FOUND);
				}
				password = params.get("password");
				if(!params.containsKey("repeatPassword")) {
					return new ResponseEntity<List<String>>(Arrays.asList("Parola tekrarı parametresi zorunludur."), HttpStatus.NOT_FOUND);
				}
				repeatPassword = params.get("repeatPassword");
				if(!password.equals(repeatPassword)) {
					return new ResponseEntity<List<String>>(Arrays.asList("Parolalar uyuşmamaktadır."), HttpStatus.NOT_FOUND);
				}
				//update user password
				LdapEntry ldapEntry=null;
				try {
					configurationService.destroyConfigParams();
					String filter= "(&(objectClass=pardusAccount)(objectClass=pardusLider)(liderPrivilege=ROLE_USER)(uid=$1))".replace("$1", fp.get().getUsername());
					List<LdapEntry> ldapEntries  = ldapService.findSubEntries(filter,
							new String[] { "*" }, SearchScope.SUBTREE);

					if(ldapEntries.size()>0) {
						ldapEntry=ldapEntries.get(0);
					}
				} catch (Exception e) {
					e.printStackTrace();
					HttpHeaders headers = new HttpHeaders();
					return ResponseEntity.
							status(HttpStatus.EXPECTATION_FAILED).
							headers(headers)
							.build();
				}
				try {
					//change password history
					for (int i = 0; i < 5; i++) {
						int p = (int)((Math.random() * 1234) + 1111);
						ldapService.updateConsoleUserPassword(ldapEntry.getDistinguishedName(), "userPassword", String.valueOf(p));
					}
					ldapService.updateConsoleUserPassword(ldapEntry.getDistinguishedName(), "userPassword", password);
				} catch (LdapException e) {
					logger.error("Error occured while updating user password. Error: " + e.getMessage());
					return new ResponseEntity<List<String>>(Arrays.asList("Parola değiştirilirken hata oluştu, lütfen tekrar deneyiniz."), 
							HttpStatus.EXPECTATION_FAILED);
				}
				//delete forgot password key
				forgotPasswordService.deleteByUsername(fp.get().getUsername());
				
				Map<String, Object> requestData = new HashMap<String, Object>();
				requestData.put("username",ldapEntry.getDistinguishedName());
				requestData.put("email",ldapEntry.getMail());
				ObjectMapper dataMapper = new ObjectMapper();
				String jsonString = null ; 
				try {
					jsonString = dataMapper.writeValueAsString(requestData);
				} catch (JsonProcessingException e1) {
					logger.error("Error occured while mapping request data to json. Error: " +  e1.getMessage());
				}
				String log = ldapEntry.getDistinguishedName() + " password has been changed";
				operationLogService.saveOperationLog(OperationType.CHANGE_PASSWORD, log, jsonString.getBytes(), null, null, null);
//				
				return new ResponseEntity<List<String>>(Arrays.asList("Parolanız başarılı bir şekilde yenilendi. Şimdi giriş yapabilirsiniz."), 
						HttpStatus.OK);
			}
		}

	}
}
